// Copyright (c) 2022 Siemens

/**
 * @module js/awClsSubscriptionCriteriaService
 */

import soaSvc from 'soa/kernel/soaService';
import _ from 'lodash';
import appCtx from 'js/appCtxService';

var CST_PREFIX = 'Cst0';
var JSON_REQUEST_TYPE_PROP = 'PropertyDefinition';
var JSON_REQUEST_TYPE_NODE = 'NodeDefinition';
var JSON_REQUEST_ENGLISH_LOCALE = 'en_US';
var JSON_REQUEST_SCHEMA_VERSION = '1.2.0';
var IRDI = 'IRDI';
var ID = 'ID';
var NODE_ID = 'NodeId';
var NAME = 'Name';
var SORT_ASC = 'ASC';
var CLASS_SYSTEM_ADVANCED = 'Advanced';
var CLASS_SYSTEM_BASIC = 'Basic';
var NODE_TYPE_MASTER = 'MasterNode';
var Classification_SOA_NAME  = 'ClassificationCommon-2020-12-Classification';
var Classification_OPERATION_NAME = 'searchClassificationDefinitions';


/**
 * Create Input for SOA and get display name from Node_Id
 * @param {Object} subscriptionObject - Subscription object.
 */
export let processClassificationCriteria = function( subscriptionObject ) {
    let dbValues = [];

    _.forEach( subscriptionObject.props.attribute_names.dbValue, function( val ) {
        if ( val !== undefined && val !== null && val !== '' ) {
            if ( val.includes( CST_PREFIX ) ) {
                dbValues.push( val );
            }
        }
    } );

    if ( dbValues.length !== 0 ) {
        let resultMap = new Map();
        let promises = [];

        for ( let dbVal of dbValues ) {
            let inputarr = dbVal.split( '.' );
            let modifiedArr = inputarr.map( item => item.replace( /Cst0|cst0/g, '' ) );
            let firstItem = modifiedArr[0];
            let secondItem = modifiedArr[1];

            if ( modifiedArr.length === 2 ) {
                // Remove sml0 prefix from the second item
                secondItem = secondItem.replace( /sml0/g, '' );

                let firstRequest = {
                    ObjectType: JSON_REQUEST_TYPE_NODE,
                    SearchExpression: {
                        $eq: {
                            ID: NODE_ID,
                            Value: firstItem
                        }
                    },
                    Options: {
                        loadObjects: true,
                        loadDependentObjects: true
                    },
                    OrderBy: [
                        {
                            ID: NAME,
                            Sort: SORT_ASC
                        }
                    ]
                };

                let singleRequest = {
                    SchemaVersion: JSON_REQUEST_SCHEMA_VERSION,
                    Locale: JSON_REQUEST_ENGLISH_LOCALE,
                    IncludeDescriptors: true,
                    SearchCriteria: [ firstRequest ],
                    ClassificationSystem: CLASS_SYSTEM_ADVANCED
                };

                let jsonString = JSON.stringify( singleRequest );
                let request = {
                    jsonRequest: jsonString
                };

                promises.push(
                    new Promise( ( resolve, reject ) => {
                        soaSvc.post( Classification_SOA_NAME, Classification_OPERATION_NAME, request )
                            .then( response => {
                                let parsedResponse = JSON.parse( response.out );
                                let nodeType = parsedResponse.ObjectDefinitions && parsedResponse.ObjectDefinitions[firstItem] && parsedResponse.ObjectDefinitions[firstItem].NodeType;
                                let inputarr = dbVal.split( '.' );
                                let modifiedArr = inputarr.map( item => item.replace( /Cst0|cst0/g, '' ) );
                                let firstName = modifiedArr[0]; // Access only the first item

                                if ( parsedResponse.ObjectDefinitions && parsedResponse.ObjectDefinitions[firstName] ) {
                                    firstName = parsedResponse.ObjectDefinitions[firstName].Name;
                                }

                                let secondRequest = {
                                    ObjectType: JSON_REQUEST_TYPE_PROP,
                                    SearchExpression: {
                                        $eq: {
                                            ID: nodeType === NODE_TYPE_MASTER ? ID : IRDI,
                                            Value: secondItem
                                        }
                                    },
                                    Options: {
                                        loadObjects: true,
                                        loadDependentObjects: true
                                    },
                                    OrderBy: [
                                        {
                                            ID: NAME,
                                            Sort: SORT_ASC
                                        }
                                    ]
                                };

                                let secondSingleRequest = {
                                    SchemaVersion: JSON_REQUEST_SCHEMA_VERSION,
                                    Locale: JSON_REQUEST_ENGLISH_LOCALE,
                                    IncludeDescriptors: true,
                                    SearchCriteria: [ secondRequest ],
                                    ClassificationSystem: nodeType === NODE_TYPE_MASTER ? CLASS_SYSTEM_BASIC : CLASS_SYSTEM_ADVANCED
                                };

                                let secondJsonString = JSON.stringify( secondSingleRequest );
                                let secondRequestObj = {
                                    jsonRequest: secondJsonString
                                };

                                soaSvc.post( Classification_SOA_NAME, Classification_OPERATION_NAME, secondRequestObj )
                                    .then( secondResponse => {
                                        let secondParsedResponse = JSON.parse( secondResponse.out );
                                        let inputarr = dbVal.split( '.' );
                                        let modifiedArr = inputarr.map( item => item.replace( /Cst0|cst0/g, '' ) );
                                        modifiedArr = modifiedArr.map( item => item.replace( /Sml0|sml0/g, '' ) );
                                        let secondName = modifiedArr[1]; // Access only the second item

                                        if ( secondParsedResponse.ObjectDefinitions && secondParsedResponse.ObjectDefinitions[secondName] ) {
                                            secondName = secondParsedResponse.ObjectDefinitions[secondName].Name;
                                        }
                                        let finalString = firstName + '.' + secondName;
                                        resultMap.set( dbVal, finalString );
                                        resolve();
                                    } )
                                    .catch( error => {
                                        console.error( 'Error during second SOA call:', error );
                                        reject( error );
                                    } );
                            } )
                            .catch( error => {
                                console.error( 'Error during first SOA call:', error );
                                reject( error );
                            } );
                    } )
                );
            } else {
                let jsonRequests = modifiedArr.map( ( item, index ) => {
                    let isFirstItem = index === 0;
                    return {
                        ObjectType: isFirstItem ? JSON_REQUEST_TYPE_NODE : JSON_REQUEST_TYPE_PROP,
                        SearchExpression: {
                            $eq: {
                                ID: isFirstItem ? NODE_ID : IRDI,
                                Value: item
                            }
                        },
                        Options: {
                            loadObjects: true,
                            loadDependentObjects: true
                        },
                        OrderBy: [
                            {
                                ID: NAME,
                                Sort: SORT_ASC
                            }
                        ]
                    };
                } );

                let singleRequest = {
                    SchemaVersion: JSON_REQUEST_SCHEMA_VERSION,
                    Locale: JSON_REQUEST_ENGLISH_LOCALE,
                    IncludeDescriptors: true,
                    SearchCriteria: jsonRequests,
                    ClassificationSystem: CLASS_SYSTEM_ADVANCED
                };

                let jsonString = JSON.stringify( singleRequest );
                let request = {
                    jsonRequest: jsonString
                };

                promises.push(
                    new Promise( ( resolve, reject ) => {
                        soaSvc.post( Classification_SOA_NAME, Classification_OPERATION_NAME, request )
                            .then( response => {
                                let parsedResponse = JSON.parse( response.out );
                                let inputarr = dbVal.split( '.' );
                                let modifiedArr = inputarr.map( item => item.replace( /Cst0|cst0/g, '' ) );
                                let finalNames = modifiedArr.map( item => {
                                    if ( parsedResponse.ObjectDefinitions && parsedResponse.ObjectDefinitions[item] ) {
                                        return parsedResponse.ObjectDefinitions[item].Name;
                                    }
                                    return item;
                                } );
                                let finalString = finalNames.join( '.' );
                                resultMap.set( dbVal, finalString );
                                resolve();
                            } )
                            .catch( error => {
                                console.error( 'Error during SOA call:', error );
                                reject( error );
                            } );
                    } )
                );
            }
        }

        return Promise.all( promises ).then( () => {
            appCtx.updatePartialCtx( 'cls_display', resultMap );
            return resultMap;
        } );
    }
    return Promise.resolve( new Map() );
};

const exports = {
    processClassificationCriteria
};
export default exports;
