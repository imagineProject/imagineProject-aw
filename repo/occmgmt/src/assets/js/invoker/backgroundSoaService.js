// Copyright (c) 2022 Siemens
/* eslint-disable sonarjs/cognitive-complexity */

/**
 * This is the Teamcenter Background SOA Service.
 * It is derived from soaService.js
 * It is designed to allow invokation of SOA calls that the user should not be aware of
 * without triggering the Progress Indicator bar
 *
 * Note: Many of the the functions defined in this module return a {@linkcode module:angujar~Promise|Promise} object.
 * The caller should provide callback function(s) to the 'then' method of this returned object (e.g. successCallback,
 * [errorCallback, [notifyCallback]]). These methods will be invoked when the associated service result is known.
 *
 * @module js/invoker/backgroundSoaService
 */

import soaSvc from 'soa/kernel/soaService';
import AwPromiseService from 'js/awPromiseService';
import cdm from 'soa/kernel/clientDataModel';
import cmm from 'soa/kernel/clientMetaModel';
import propPolicySvc from 'soa/kernel/propertyPolicyService';
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';
import assert from 'assert';
import Debug from 'debug';
import logger from 'js/logger';
import eventBus from 'js/eventBus';
import browserUtils from 'js/browserUtils';
//import AwHttpService from 'js/awHttpService';
//import configSvc from 'js/configurationService';
//import localStrg from 'js/localStorage';

/**
 * SOA redirect
 */
// CHRIS TODO: Need to get this value from soaService.js
let _redirectSoaSvc = false;

export const setSoaRedirect = function( redirect ) { _redirectSoaSvc = redirect; };

/** Debug trace function */
const trace = new Debug( 'backgroundSoaService' );

let pendingRequests = 0;

// Response processing

/**
 * Process an array of objects to create a single string of messages.
 *
 * @param {Object} messages - array of objects containing message fields
 * @param {Object} msgObj - message object with message value & level
 */
function getMessageString( messages, msgObj ) {
    _.forEach( messages, function( object ) {
        if( msgObj.msg.length > 0 ) {
            msgObj.msg += '\n';
        }
        msgObj.msg += object.message;
        msgObj.level = _.max( [ msgObj.level, object.level ] );
    } );
}

/**
 * Return a reference to a new 'error' object set with the given error information.
 *
 * @param {Object} errIn - error in
 *
 * @returns {Object} - JavaScript Error object
 */
export const createError = function( errIn ) {
    const msgObj = {
        msg: '',
        level: 0
    };
    if( errIn.message ) {
        msgObj.msg = errIn.message;
    } else if( errIn.status || errIn.statusText ) {
        msgObj.msg = errIn.status + ' ' + errIn.statusText;
    } else if( errIn.PartialErrors ) {
        _.forEach( errIn.PartialErrors, function( partialError ) {
            getMessageString( partialError.errorValues, msgObj );
        } );
    } else if( errIn.partialErrors ) {
        _.forEach( errIn.partialErrors, function( partialError ) {
            getMessageString( partialError.errorValues, msgObj );
        } );
    } else if( errIn.messages ) {
        getMessageString( errIn.messages, msgObj );
    } else {
        msgObj.msg = errIn.toString();
    }
    if( errIn.data && errIn.data.messages ) {
        getMessageString( errIn.data.messages, msgObj );
    }
    const error = new Error( msgObj.msg );
    error.cause = errIn;
    error.level = msgObj.level;
    return error;
};

/**
 * @param {Object} response - response
 * @return {Object|null} service data
 */
function getServiceData( response ) {
    if( response.hasOwnProperty( '.QName' ) && /\.ServiceData$/.test( response[ '.QName' ] ) ) {
        return response;
    } else if( response.ServiceData ) {
        // If the service data is a member field, update the service data reference
        return response.ServiceData;
    }
    return undefined;
}

/**
 * Process SOA partial exceptions in response.
 *
 * @param {Object} response JSON response data
 * @param {String} serviceName - service name
 * @param {String} operationName - operation name
 * @return {Object} response JSON response data
 */
function processExceptions( response, serviceName, operationName ) {
    const serviceData = getServiceData( response );
    if( serviceData && serviceData.partialErrors ||
        response.PartialErrors && !_.isEmpty( response.PartialErrors ) ) {
        // Publish SAN event to log the SOA errors to analytics
        let qName = 'unknown';
        if( response.hasOwnProperty( '.QName' ) ) {
            qName = response[ '.QName' ];
        }

        eventBus.publishOnChannel( {
            channel: 'SAN_Events',
            topic: 'aw-command-logErrros',
            data: {
                sanQName: qName,
                sanPartialErrors: serviceData && serviceData.partialErrors || response,
                sanServiceName: serviceName,
                sanOperationName: operationName,
                sanLogCorrelationID: logger.getCorrelationID()
            }
        } );
    }

    // Should we search for 'Exception' in QName?
    if( response && response.hasOwnProperty( '.QName' ) ) {
        if( /InvalidUserException$/.test( response[ '.QName' ] ) ) {
            // hit the InvalidUserException during a non-login related SOA call.
            // this is a session time-out situation.
            eventBus.publish( 'session.stale', {} );

            console.log( 'Encountered Session timeout. SOA Request for service: ' + serviceName + ', ' + // eslint-disable-line no-console
                operationName + '  Will refresh the page in order to re-Authenticate.' );
            // assumption is that we've timed out, so need to "reAuthenticate".
            // Legacy GWT logic would call the session manager to reauthenticate(), but that
            // pattern is no longer used.  In general we just will reload the page and
            // that will update the authentication state and trigger reauthentication.
            location.reload( false ); // trigger a page refresh, that will reload and authenticate again.
        }
        // FIXME this should be conditioned with a QName check...
        if( /Exception$/.test( response[ '.QName' ] ) ) {
            throw exports.createError( response );
        }
    }

    return response;
}

/**
 * @private
 * @param {Object} parent - parent element
 * @param {Array} modelObjs - Array of {ModelObject} found in response
 * @param {Object} typeNames - array of referenced type names
 */
function extractModelObjAndTypeFromResponse( parent, modelObjs, typeNames ) {
    _.forEach( parent, function( child, key ) {
        if( _.isPlainObject( child ) ) {
            if( child.hasOwnProperty( 'uid' ) && child.hasOwnProperty( 'type' ) ) {
                if( child.uid && child.uid !== cdm.NULL_UID ) {
                    if( modelObjs ) {
                        modelObjs.push( child );
                    } else {
                        const modelObj = cdm.getObject( child.uid );
                        if( modelObj ) {
                            parent[ key ] = modelObj;
                        }
                    }
                }
                if( typeNames && child.type && child.type !== 'unknownType' ) {
                    typeNames[ child.type.toString() ] = null;
                }
            } else {
                extractModelObjAndTypeFromResponse( child, modelObjs, typeNames );
            }
        } else if( _.isArray( child ) ) {
            extractModelObjAndTypeFromResponse( child, modelObjs, typeNames );
        }
    } );
}

/**
 * @private
 * @param {Object} response - Response from SOA service.
 * @param {Array} modelObjs - Array of {ModelObject} from SOA service.
 * @returns {Object} Response from SOA service.
 */
function processResponseObjects( response, modelObjs ) {
    const serviceData = getServiceData( response );
    let updatedObjs = [];
    if( modelObjs && modelObjs.length > 0 ) {
        // Add objects to CDM
        cdm.cacheObjects( modelObjs );
        updatedObjs = modelObjs;

        // To support the anti-pattern of code pulling the modelObject from the response, we need to update the response serviceData.
        extractModelObjAndTypeFromResponse( response );
    }
    if( serviceData ) {
        if( serviceData.created ) {
            const createdObjects = [];
            _.forEach( serviceData.created, function( uid ) {
                const createdObject = cdm.getObject( uid );
                if( createdObject ) {
                    createdObjects.push( createdObject );
                }
            } );
            if( createdObjects.length ) {
                eventBus.publish( 'cdm.created', {
                    createdObjects: createdObjects
                } );
            }
        }
        if( serviceData.updated ) {
            const updatedObjects = [];
            _.forEach( serviceData.updated, function( uid ) {
                if( !cmm.isTypeUid( uid ) ) {
                    const updatedObject = cdm.getObject( uid );
                    if( updatedObject ) {
                        updatedObjects.push( updatedObject );
                    }
                }
            } );
            if( updatedObjects.length ) {
                eventBus.publish( 'cdm.updated', {
                    updatedObjects: updatedObjects
                } );
            }
        }
        if( serviceData.deleted ) {
            // Remove objects from CDM
            cdm.removeObjects( serviceData.deleted );
        }
    }
    const currentStore = appCtxSvc.getCtx( 'vmo' ) || {};
    let timeNow = Date.now();
    let values = {};
    if( updatedObjs.length ) {
        for( const mo of updatedObjs ) {
            let refUid = getRefUid( mo );
            let uidVal = mo.uid;
            currentStore[ uidVal ] = {
                type: mo.type,
                time: timeNow,
                ref: refUid
            };
            if( uidVal ) {
                values[ uidVal ] = true;
            }
        }
        const storeValues = Object.entries( currentStore );
        if( !_.isEmpty( values ) ) {
            for( const [ uid, { type, ref } ] of storeValues ) {
                if( values[ ref ] ) {
                    currentStore[ uid ] = {
                        type: type,
                        time: timeNow,
                        ref: ref
                    };
                }
            }
        }
        appCtxSvc.registerCtx( 'vmo', currentStore );
    }
    return response;
}

const getRefUid = mo => {
    if( mo.type === 'Awp0XRTObjectSetRow' && mo.props && mo.props.awp0Target ) {
        return mo.props.awp0Target.dbValues[ 0 ];
    }
    return null;
};

/**
 * Process service data in HTTP response.
 *
 * @param {Object} response - JSON response data
 * @param {String} operationName - operation name
 * @return {Promise} Promise resolved once types are loaded
 */
function processResponseTypes( response ) {
    if( response ) {
        const modelObjs = [];
        const typeNamesObj = {};

        const qName = response[ '.QName' ];
        if( qName !== 'http://teamcenter.com/Schemas/Soa/2011-06/MetaModel.TypeSchema' ) {
            extractModelObjAndTypeFromResponse( response, modelObjs, typeNamesObj );
        }

        const typeNames = Object.keys( typeNamesObj );

        return soaSvc.ensureModelTypesLoaded( typeNames ).then( function() {
            // Just in case we have more types, let's go get them...
            return processResponseObjects( response, modelObjs );
        } );
    }

    return AwPromiseService.instance.resolve();
}

/**
 *
 * Gets the effective property policy
 *
 * @param {Object|String} propertyPolicyOverride - SOA property policy override (or NULL)
 * @param {boolean} isSelectedPropertyPolicy - boolean which indicates whether the selected property is required
 *            or not.
 * @returns {Object} request body with defaulting & validation complete
 * @private
 */
function getEffectivePropertyPolicy( propertyPolicyOverride, isSelectedPropertyPolicy ) {
    if( _.isString( propertyPolicyOverride ) ) {
        return JSON.parse( propertyPolicyOverride );
    }
    if( _.isObject( propertyPolicyOverride ) ) {
        // No need to pass a property policy for this call.
        return propertyPolicyOverride;
    }
    return propPolicySvc.getEffectivePolicy( exports, isSelectedPropertyPolicy );
}

// eslint-disable-next-line require-jsdoc
function getXSRFToken() {
    var token = '';
    if ( document !== null && document !== undefined && document.cookie.search( 'XSRF-TOKEN' ) > -1 ) {
        var splitAtr = document.cookie.split( 'XSRF-TOKEN=' );
        if ( splitAtr.length === 2 ) {
            //returns the first element
            token = splitAtr[1].split( ';' )[0];
        }
    }
    return token;
}

/**
 * Teamcenter SOA request.
 *
 * @param {String} serviceName - SOA service name
 * @param {String} operationName - SOA operation name
 * @param {String} body - JSON body
 *
 * @param {Object|String} propertyPolicyOverride - SOA property policy override (or NULL)
 * @param {Bool} ignoreHost - Flag to say ignore hosting when making soa call.
 * @param {Object|String} headerStateOverride - SOA header state override (or NULL)
 * @param {Boolean} checkPartialErrors - check for partial errors in the response
 *
 * @returns {Promise} This promise will be 'resolved' or 'rejected' when the service is invoked and its response
 *          data is available.
 */
export const request = function( serviceName, operationName, body, {
    propertyPolicyOverride,
    ignoreHost = false,
    headerStateOverride = false,
    checkPartialErrors = false
} = {} ) {
    assert( serviceName, 'Service name not provided!' );
    assert( operationName, 'Operation name not provided!' );

    if( appCtxSvc.ctx.aw_hosting_enabled && !appCtxSvc.ctx.aw_hosting_soa_support_checked ) {
        appCtxSvc.ctx.aw_hosting_soa_support_checked = true;
    }

    let isSelectedPropertyPolicy = false;
    //if( body ) {
    //    isSelectedPropertyPolicy = propPolicySvc.checkForSelectedObject( body );
    //}

    const jsonData = {
        header: {
            state: {
                clientVersion: '10000.1.2',
                /**
                 * Correlation ID for logging purposes (debug).
                 */
                logCorrelationID: logger.getCorrelationID(),
                stateless: true,

                /**
                 * If true, process server-session state key/value pairs found in the request headers. This
                 * turns all session state into client-session data. The standalone AW client should set this to
                 * true, while the hosted AW client should set it false (or not send it at all).
                 */
                enableServerStateHeaders: !_redirectSoaSvc,
                /**
                 */
                formatProperties: true
            },
            policy: getEffectivePropertyPolicy( propertyPolicyOverride, isSelectedPropertyPolicy )
        },
        body: body
    };
    // defaultAndValidateElement( schemaService, serviceName, operationName, body )

    mergeHeaderState( jsonData.header.state, headerStateOverride );

    let clientId = soaSvc.getClientIdHeader();
    if( !_redirectSoaSvc && clientId !== '' ) {
        jsonData.header.state.clientID = clientId;
    }

    const headers = {
        // Only US-ASCII characters are allowed in HTTP headers
        // http://stackoverflow.com/questions/34670413/regexp-to-validate-a-http-header-value/34710882#34710882
        'Log-Correlation-ID': jsonData.header.state.logCorrelationID.replace( /[^\x20-\x7E]+/g, '' ),
        Accept: 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        'X-XSRF-TOKEN': getXSRFToken()
    };

    let endPt = serviceName + '/' + operationName;
    if( logger.isTraceEnabled() ) {
        logger.trace( '\n' + 'backgroundSoaService.post to ' + endPt, jsonData );
    }

    pendingRequests++;

    /**
     * Check if there is a 'host' process that is handling SOA processing<BR>
     * If so: Send the 'endPt' and data to that service.
     */

    // The only case the client will make its own login call when hosted would be when it needs credentials.
    // If such a call is made, we should not make it through the host. This is the only case when AW talks directly to the server.
    // This will allow Viewer to show up in hosts.
    if( _redirectSoaSvc && !ignoreHost ) {
        return _redirectSoaSvc.post( serviceName, operationName, jsonData );
    }

    /*
    const $http = AwHttpService.instance;
    trace( 'HTTP call start', serviceName, operationName );
    return $http.post( browserUtils.getBaseURL() + 'tc/RestServices/' + endPt, jsonData, {
        headers: headers
    } ).then( function( response ) {
        trace( 'HTTP call complete', serviceName, operationName );
        assert( response, 'No response given for ' + endPt );

        const body2 = response.data;

        assert( typeof body2 !== 'string' || body2.indexOf( '<?xml version' ) === -1,
            'Unexpected response body for: ' + endPt );

        return body2;
    } ).then( function( response ) {
        pendingRequests--;
        if( logger.isTraceEnabled() ) {
            logger.trace( 'endPt=' + endPt, response );
        }
        return processExceptions( response, serviceName, operationName );
    }, function( err ) {
        pendingRequests--;
        throw exports.createError( err );
    } ).then( function( response ) {
        return processResponseTypes( response );
    } ).then( function( response ) {
        if( checkPartialErrors && response ) {
            if( response.PartialErrors ) {
                throw exports.createError( response.PartialErrors );
            }
            const serviceData = getServiceData( response );
            if( serviceData && serviceData.partialErrors ) {
                throw exports.createError( serviceData );
            }
        }
        return response;
    } ); */

    trace( 'HTTP call start', serviceName, operationName );
    return fetch( browserUtils.getBaseURL() + 'tc/RestServices/' + endPt, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify( jsonData ),
        credentials: 'include'
    } ).then( function( response ) {
        trace( 'HTTP call complete', serviceName, operationName );
        assert( response, 'No response given for ' + endPt );

        const body2 = response.json();
        assert( typeof body2 !== 'string' || body2.indexOf( '<?xml version' ) === -1,
            'Unexpected response body for: ' + endPt );

        return body2;
    } ).then( function( body2 ) {
        pendingRequests--;
        if( logger.isTraceEnabled() ) {
            logger.trace( 'endPt=' + endPt, body2 );
        }

        processExceptions( body2, serviceName, operationName );
        processResponseTypes( body2 );

        if( checkPartialErrors && body2 ) {
            if( body2.PartialErrors ) {
                throw exports.createError( body2.PartialErrors );
            }
            const serviceData = getServiceData( body2 );
            if( serviceData && serviceData.partialErrors ) {
                throw exports.createError( serviceData );
            }
        }

        return body2;
    }, function( err ) {
        pendingRequests--;
        throw exports.createError( err );
    } );
};

/**
 * Merge default header state with the given overrides
 *
 * @param {Object|String} defaultHeaderState - SOA header state default (or NULL)
 * @param {Object|String} headerStateOverride - SOA header state override (or NULL)
 */
function mergeHeaderState( defaultHeaderState, headerStateOverride ) {
    const keys = headerStateOverride ? Object.keys( headerStateOverride ) : [];
    for( let i = 0; i < keys.length; ++i ) {
        defaultHeaderState[ keys[ i ] ] = headerStateOverride[ keys[ i ] ];
    }
}

/**
 * SOA post unchecked.
 *
 * @param {String} serviceName - SOA service name
 * @param {String} operationName - SOA operation name
 * @param {String} body - JSON body
 * @param {Object|String} propertyPolicyOverride - SOA property policy override (or NULL)
 * @param {Bool} ignoreHost - Flag to say ignore hosting when making soa call.
 * @param {Object|String} headerStateOverride - SOA header state override (or NULL)
 * @returns {Promise} This promise will be 'resolved' or 'rejected' when the service is invoked and its response
 *          data is available.
 */
export const postUnchecked = function( serviceName, operationName, body, propertyPolicyOverride, ignoreHost, headerStateOverride ) {
    return exports.request( serviceName, operationName, body, {
        propertyPolicyOverride: propertyPolicyOverride,
        ignoreHost: ignoreHost,
        headerStateOverride: headerStateOverride
    } );
};

/**
 * SOA post.
 *
 * If the response contains partial errors, it will be treated as an exception & thrown. If this isn't desired,
 * use postUnchecked.
 *
 * @param {String} serviceName - SOA service name
 * @param {String} operationName - SOA operation name
 * @param {String} body - JSON body
 * @param {Object|String} propertyPolicyOverride - SOA property policy override (or NULL)
 * @param {Boolean} ignoreHost - ignore SOA tunnel by host?
 * @returns {Promise} This promise will be 'resolved' or 'rejected' when the service is invoked and its response
 *          data is available.
 */
export const post = function( serviceName, operationName, body, propertyPolicyOverride, ignoreHost ) {
    // Call CFX soa service with backgroundCall = true
    return soaSvc.request( serviceName, operationName, body, {
        propertyPolicyOverride: propertyPolicyOverride,
        ignoreHost: ignoreHost,
        checkPartialErrors: true,
        backgroundCall:true
    } );
};

export const getPendingRequestsCount = function() {
    return pendingRequests;
};

const exports = {
    createError,
    postUnchecked,
    post,
    request,
    setSoaRedirect,
    getPendingRequestsCount
};
export default exports;
