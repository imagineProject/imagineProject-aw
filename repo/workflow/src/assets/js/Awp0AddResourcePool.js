// Copyright (c) 2022 Siemens

/**
 * @module js/Awp0AddResourcePool
 */
import cdm from 'soa/kernel/clientDataModel';
import _ from 'lodash';
import parsingUtils from 'js/parsingUtils';
import appCtxSvc from 'js/appCtxService';

/**
  * Define public API
  */
var exports = {};
var _resourcePoolNonModifiableCols = [ 'group', 'role' ];

/**
 * Get the input object property and return the internal  value.
 *
 * @param {Object} modelObject Model object whose propeties need to be loaded
 * @param {String} propName Property name that need to be checked
 *
 * @returns {Array} Property internal value
 */
var _getPropValue = function( modelObject, propName ) {
    if( modelObject && modelObject.props && modelObject.props[ propName ] && modelObject.props[ propName ].dbValues ) {
        return modelObject.props[ propName ].dbValues;
    }
    return null;
};

/**
 * Get userinbox for input user object.
 *
 * @param {Object} userObject User object for profile page is showm
 * @returns {Object} User inbox object
 */
var _getUserInboxObject = function( userObject ) {
    var userInbox = null;
    var userInboxdbValues = _getPropValue( userObject, 'userinbox' );
    if( userInboxdbValues && userInboxdbValues[ 0 ] ) {
        userInbox =  cdm.getObject( userInboxdbValues[ 0 ] );
    }
    return userInbox;
};

/**
 * Get subscribed_inboxes for input user object.
 *
 * @param {Object} userObject User object for profile page is showm
 * @returns {Array} Subscribe inboxes objects
 */
var _getSubscribeTaskInboxes = function( userObject ) {
    var taskInboxeObjects = [];
    var subscribedInboxesdbValues = _getPropValue( userObject, 'subscribed_inboxes' );
    if( subscribedInboxesdbValues && !_.isEmpty( subscribedInboxesdbValues ) ) {
        _.forEach( subscribedInboxesdbValues, function( dbValue ) {
            var taskInbox =  cdm.getObject( dbValue );
            if( taskInbox ) {
                taskInboxeObjects.push( taskInbox );
            }
        } );
    }
    return taskInboxeObjects;
};

/**
  * Get the input for removing the resource pool inboxes.
  *
  * @param {Object} userObject - User object where selected resource pool need to be removed
  * @param {Object} selectedObjects - the selected resource pool from the table
  *
  * @returns {Object} deleteInputs Delete input for remove resource pool inboxes
  */
export let removeSubscribedResourcePools = function( userObject, selectedObjects ) {
    var deleteInputs = [];
    // Check if input user object is not valid or selected objects is empty or invalid then
    // no need to process further and return empty input from here.
    if( !userObject || !selectedObjects || _.isEmpty( selectedObjects ) ) {
        return deleteInputs;
    }

    // Get the latest user object and then userIbnox and task inbox object from that user object
    var userModelObject = cdm.getObject( userObject.uid );
    var userInbox = _getUserInboxObject( userModelObject );
    var taskInboxes = _getSubscribeTaskInboxes( userModelObject );

    if( userInbox && taskInboxes && !_.isEmpty( taskInboxes ) ) {
        _.forEach( taskInboxes, function( taskInbox ) {
            var taskInboxOwnerUid = null;
            // Get the owner proeprty for task inbox object
            var inboxOwnerDbValues = _getPropValue( taskInbox, 'owner' );
            if( inboxOwnerDbValues && inboxOwnerDbValues[ 0 ] ) {
                taskInboxOwnerUid = inboxOwnerDbValues[ 0 ];
            }

            // Get the resource pool object from selected object and matching task inbox
            // owner uid. If match found then only use it for delete relation.
            var resourcePoolObject = _.find( selectedObjects, function( selectedObject ) {
                return selectedObject.uid === taskInboxOwnerUid;
            } );

            // If resource pool object is not null that means this task inbox need to be removed
            // so create the deleteRelation input for that task inbox.
            if( resourcePoolObject ) {
                var inputForDelete = {};
                inputForDelete.primaryObject = userInbox;
                inputForDelete.secondaryObject = taskInbox;
                inputForDelete.relationType = 'contents';
                inputForDelete.clientId = 'remove_task_inbox' + taskInbox.uid;

                deleteInputs.push( inputForDelete );
            }
        } );
    }
    return deleteInputs;
};

/**
 * Based on preference value EPM_resource_pool_restrict_subscription we need to update
 * addUserPanelState criteria. If value is ON then we need to pass showRPAccessibleFilter as 'true'
 * else we need to pass 'false.
 *
 * @param {Object} addUserPanelState User panel state that need to be updated
 * @returns {Object} Updated user panel state object
 */
export let updateUserPanelState = function( addUserPanelState ) {
    const userPanelState = { ...addUserPanelState };
    var showRPAccessibleFilter = 'true';
    // Based on preference value set the showRPAccessibleFilter to true or false string value.
    if( appCtxSvc.ctx && appCtxSvc.ctx.preferences && appCtxSvc.ctx.preferences.EPM_resource_pool_restrict_subscription
        && appCtxSvc.ctx.preferences.EPM_resource_pool_restrict_subscription[ 0 ] ) {
        var prefValue = appCtxSvc.ctx.preferences.EPM_resource_pool_restrict_subscription[ 0 ];
        if( prefValue && prefValue.trim().toLowerCase() === 'on' ) {
            showRPAccessibleFilter = 'false';
        }
    }
    userPanelState.criteria.showRPAccessibleFilter = showRPAccessibleFilter;
    return {
        userPanelState : userPanelState,
        isDataInit : true
    };
};

/**
  * prepare the input for set properties SOA call to add resource Pool
  *
  * @param {Object} userObject - User object where selected resource pool need to be added
  * @param {Object} selectedObjects - the selected resource pool from the table
  *
  * @returns {Array} inputData Add resource pool SOA input array
  */
export let prepareSubscribeResourcePoolInput = function( userObject, selectedObjects ) {
    var inputData = [];
    // Check if input user object is not valid or selected objects is empty or invalid then
    // no need to process further and return empty input from here.
    if( !userObject || !selectedObjects || _.isEmpty( selectedObjects ) ) {
        return inputData;
    }
    var infoObj = {};
    infoObj.object = cdm.getObject( userObject.uid );
    var resourcePools = [];
    _.forEach( selectedObjects, function( selectedObject ) {
        resourcePools.push( selectedObject.uid );
    } );

    infoObj.vecNameVal = [ {
        name : 'subscribed_resourcepools',
        values : resourcePools
    } ];

    inputData.push( infoObj );
    return inputData;
};

/**
 * Get the subscribe resource pool objects that need to be shown in table.
 *
 * @param {Object} response Response object that contains all objects that need to be shown in table
 * @returns {Array} Resource pool objects that need to be shown in table
 */
export let processResourcePoolObjects = function( response ) {
    var resourcePools = [];
    if( response.partialErrors || response.ServiceData && response.ServiceData.partialErrors ) {
        return resourcePools;
    }
    if( response.searchResultsJSON ) {
        var searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );
        if( searchResults ) {
            for( var x = 0; x < searchResults.objects.length; ++x ) {
                var uid = searchResults.objects[ x ].uid;
                var obj = response.ServiceData.modelObjects[ uid ];
                if( obj ) {
                    resourcePools.push( obj );
                }
            }
        }
    }
    return resourcePools;
};

/**
 * Update the column config with modifiable as false.
 *
 * @param {Object} response Response object
 * @returns {Object} Update column config object
 */
export let setNonModifiablePropForResourcePool = function( response ) {
    for( var index = 0; index < response.columnConfig.columns.length; index++ ) {
        if( _resourcePoolNonModifiableCols.indexOf( response.columnConfig.columns[ index ].propertyName ) !== -1 ) {
            response.columnConfig.columns[ index ].modifiable = false;
        }
    }
    return response.columnConfig;
};


/**
  * This factory creates a service and returns exports
  *
  * @member Awp0AddResourcePool
  */

export default exports = {
    removeSubscribedResourcePools,
    prepareSubscribeResourcePoolInput,
    processResourcePoolObjects,
    setNonModifiablePropForResourcePool,
    updateUserPanelState
};
