// Copyright (c) 2023 Siemens

/**
 * Defines {@link awInboxPollingService} which manages unread message count.
 *
 * @module js/aw.inbox.polling.service
 */
import appCtxService from 'js/appCtxService';
import preferenceSvc from 'soa/preferenceService';
import soaSvc from 'soa/kernel/soaService';
import AwIntervalService from 'js/awIntervalService';
import AwTimeoutService from 'js/awTimeoutService';
import cdm from 'soa/kernel/clientDataModel';
import _ from 'lodash';
import eventBus from 'js/eventBus';

let exports = {};

/**
 * Constant inbox notification polling interval preference name
 */
var AWS_INBOX_POLLING_INTERVAL = 'AWS_Inbox_Polling_Interval';

var unviewedWFTaskCount = '';

var pollingInterval = 0;

var initialDelay = 5 * 1000; //miliSecs

/**
 * setting notification timeout's preference value
 */
function getPollingIntervalFromPref() {
    return preferenceSvc.getStringValue( AWS_INBOX_POLLING_INTERVAL ).then( function( result ) {
        if( result ) {
            result = parseInt( result );

            if( !isNaN( result ) && result > 0 ) {
                pollingInterval = result * 60 * 1000;

                AwTimeoutService.instance( function() {
                    exports.updateWFTaskCount();
                }, initialDelay );

                AwIntervalService.instance( function() {
                    exports.updateWFTaskCount();
                }, pollingInterval );

                eventBus.subscribe( 'gateway.contentLoaded', exports.updateWFTaskCountOnInboxChanged );
                eventBus.subscribe( 'workflow.updateTaskCount', exports.updateWFTaskCountOnInboxChanged );
            } else if( result <= 0 ) {
                pollingInterval = 0;
            }
            eventBus.unsubscribe( 'bulkPreferencesLoaded' );
            return true;
        }
        return false;
    } );
}

/**
 * Initialize the polling service
 */
export const init = function() {
    appCtxService.registerCtx( 'unviewedWFTaskCount', unviewedWFTaskCount );
    eventBus.subscribe( 'session.updated', performPolling );
};

/**
 * Performs polling
 */
function performPolling() {
    getPollingIntervalFromPref().then( function( result ) {
        if( !result ) {
            // sets the notification timeout's preference value only after preference gets loaded
            eventBus.subscribe( 'bulkPreferencesLoaded', function() {
                getPollingIntervalFromPref();
            } );
        }
    } );
}

/**
 * Calls updateWFTaskCount for events gateway.contentLoaded and
 * workflow.updateTaskCount
 */
export const updateWFTaskCountOnInboxChanged = _.debounce( function() {
    exports.updateWFTaskCount();
}, 250 );

/**
 * Fetch the unviewed task count and update ctx with unviewedWFTaskCount
 */
export const updateWFTaskCount = function() {
    soaSvc.request( 'Core-2006-03-DataManagement', 'getProperties', {
        objects: [ appCtxService.ctx.user ],
        attributes: [ 'fnd0UnviewedWFTaskCount' ]
    }, {
        checkPartialErrors: true,
        polling: true
    } ).then( () => {
        var targetObject = cdm.getObject( appCtxService.ctx.user.uid );
        if( targetObject.props.fnd0UnviewedWFTaskCount ) {
            unviewedWFTaskCount = targetObject.props.fnd0UnviewedWFTaskCount.dbValues[ 0 ];

            if( appCtxService.getCtx( 'unviewedWFTaskCount' ) ) {
                appCtxService.updateCtx( 'unviewedWFTaskCount', unviewedWFTaskCount );
            } else {
                appCtxService.registerCtx( 'unviewedWFTaskCount', unviewedWFTaskCount );
            }
        } else {
            appCtxService.registerCtx( 'unviewedWFTaskCount', '0' );
        }
    } ).catch( () => {
        // ignore error for polling call. this may indicate session is idle.
    } );
};

export default exports = {
    init,
    updateWFTaskCountOnInboxChanged,
    updateWFTaskCount
};
