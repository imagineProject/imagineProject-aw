// Copyright (c) 2022 Siemens

/**
 * @module js/autoAssignService
 */
import soaSvc from 'soa/kernel/soaService';
import cdm from 'soa/kernel/clientDataModel';
import cmm from 'soa/kernel/clientMetaModel';
import AwPromiseService from 'js/awPromiseService';
import _ from 'lodash';
import logger from 'js/logger';
import messagingService from 'js/messagingService';

/**
 * Get the owning type of the property
 *
 * @param {Object} prop - The property
 * @return {String} The owning type
 */
var _getOwningType = function( prop ) {
    let parentUid = prop.parentUid ? prop.parentUid : prop.fielddata.parentUid;
    var parentViewObj = cdm.getObject( parentUid );
    return parentViewObj.modelType ? parentViewObj.modelType.owningType : null;
};

/**
 * Extract the auto-assignable create properties from view model data.
 *
 * @param {Object} data - The view model data
 * @param {Number} opType - The operation type code
 * @return {ObjectArray} The array of auto-assignable properties
 */
var _getAllAutoAssignableProperties = function( editHandler ) {
    if( editHandler ) {
        let dataSource = editHandler.getDataSource();
        return dataSource.getAllAutoAssignableProperties();
    }

    return [];
};

/**
 * Get the operation type code given operation type string
 *
 * @param {String} operationType - The operation type, must be 'CREATE', 'REVISE', or 'SAVEAS'
 * @return {Number|null} The operation type
 */
var _getOpType = function( operationType ) {
    if( operationType === 'CREATE' ) {
        return 1;
    } else if( operationType === 'REVISE' ) {
        return 2;
    } else if( operationType === 'SAVEAS' ) {
        return 3;
    }

    return null;
};

var exports = {};

/**
 * Async function to Auto-assign all properties
 *
 * @param {Object} data - The view model data
 * @param {String} operationType - The operation type, must be 'CREATE', 'REVISE', or 'SAVEAS'
 * @param {String} createType - Object type to be created
 * @returns {Promise} Promise object
 */
export let autoAssignAllProperties = function( data, operationType, createType, editHandler ) {
    var opType = _getOpType( operationType );
    if( opType === null ) {
        logger.warn( 'autoAssignService.autoAssignProperty: unknown operation type!!' );
        return AwPromiseService.instance.resolve();
    }

    var autoAssignableProps = _getAllAutoAssignableProperties( editHandler );
    if( !autoAssignableProps || autoAssignableProps.length === 0 ) {
        logger.warn( 'autoAssignService.autoAssignAllProperties: No properties to auto-assign!!' );
        return AwPromiseService.instance.resolve();
    }

    // Populate SOA input
    var inputData = {
        generateNextValuesIn: []
    };

    _.forEach( autoAssignableProps, function( propIn ) {
        var owningType = _getOwningType( propIn );
        if( owningType === null ) {
            logger.warn( 'autoAssignService.autoAssignAllProperties: business object type for prop not found!!' );
        }

        var propName = propIn.propertyName;

        const dataSource = editHandler?.getDataSource();

        if( propIn.isAutoAssign === false && propIn.patternAutoAssignFlags ) {
            if( dataSource ) {
                let updatedProp = { ...propIn };
                updatedProp.dbValue = '';
                dataSource.updateObjects( [ updatedProp ] );
            } else {
                propIn.dbValue = '';
            }
            return;
        }

        // Fill the pattern info.
        var propNameWithPattern = {};
        if( propIn.selectedPattern && _.isString( propIn.selectedPattern ) ) {
            propNameWithPattern[ propName ] = propIn.selectedPattern;
        } else if( propIn.preferredPattern && _.isString( propIn.preferredPattern ) ) {
            propNameWithPattern[ propName ] = propIn.preferredPattern;
        } else if( _.isArray( propIn.patterns ) ) {
            propNameWithPattern[ propName ] = propIn.patterns[ 0 ];
        } else {
            propNameWithPattern[ propName ] = '';
        }

        // Deal with propNames in the following format: REF(revision,ItemRevisionCreI).item_revision_id
        if( propName.startsWith( 'REF' ) ) {
            // Currently all uses of pin panel use opertaionType CREATE
            const createInputTypeName = propName.substring( propName.indexOf( ',' ) + 1, propName.indexOf( ')' ) );
            const createInputType = cmm.getType( createInputTypeName );
            if( createInputType && createInputType.owningType ) {
                owningType = createInputType.owningType;
            } else {
                owningType = propName.substring( propName.indexOf( ',' ) + 1, propName.indexOf( ')' ) - 4 );
            }
            propName = propName.substring( propName.indexOf( '.' ) + 1 );
            propNameWithPattern = {};
            propNameWithPattern[ propName ] = '';
        }

        var input = {
            clientId: propName,
            businessObjectName: owningType,
            operationType: opType,
            propertyNameWithSelectedPattern: propNameWithPattern
        };

        inputData.generateNextValuesIn.push( input );
    } );

    if( inputData.generateNextValuesIn.length === 0 ) {
        logger.warn( 'autoAssignService.autoAssignAllProperties: No properties to auto-assign!!' );
        return;
    }


    return soaSvc.post( 'Core-2013-05-DataManagement', 'generateNextValues', inputData ).then( function( response ) {
        let dataSource;
        if( editHandler ) {
            dataSource = editHandler.getDataSource();
        }

        if( dataSource ) {
            for( let propIn of autoAssignableProps ) {
                let propName = propIn.propertyName;
                // Deal with propNames in the following format: REF(revision,ItemRevisionCreI).item_revision_id
                if( propName && propName.startsWith( 'REF' ) ) {
                    propName = propName.substring( propName.indexOf( '.' ) + 1 );
                }

                for( var id in response.generatedValues ) {
                    var genValue = response.generatedValues[ id ];

                    if( genValue.clientId === propName && genValue.generatedValues[ propName ] ) { // matched
                        if( genValue.clientId === 'item_revision_id' ) {
                            genValue.clientId = propName;
                            genValue.generatedValues[ propName ] = genValue.generatedValues.item_revision_id;
                        }
                        if( genValue.generatedValues[ propName ].errorCode === 0 ) {
                            let updatedProp = { ...propIn };
                            updatedProp.dbValue = genValue.generatedValues[ propName ].nextValue;
                            updatedProp.value = genValue.generatedValues[ propName ].nextValue;
                            updatedProp.uiValue = genValue.generatedValues[ propName ].nextValue;

                            dataSource.updateObjects( [ updatedProp ] );
                            if( propIn.onChange ) {
                                propIn.onChange( {
                                    target: {
                                        value: genValue.generatedValues[ propName ].nextValue
                                    }
                                } );
                            }
                        } else {
                            // LCS-637172 Blank out the property value if server returns error
                            let updatedProp = { ...propIn };
                            updatedProp.dbValue = '';
                            updatedProp.value = '';
                            updatedProp.uiValue = '';

                            dataSource.updateObjects( [ updatedProp ] );
                            if( propIn.onChange ) {
                                propIn.onChange( {
                                    target: {
                                        value: ''
                                    }
                                } );
                            }
                            logger.error( 'autoAssignService.autoAssignAllProperties: Auto assign failed due to errorCode ' + genValue.generatedValues[ propName ].errorCode );
                        }
                        break;
                    }
                }
            }
        }

        return null;
    } ).catch( function( error ) {
        // LCS-637172 Blank out the property value if server returns errorlet dataSource;
        handlePartialError( error );
        let dataSource;
        if( editHandler ) {
            dataSource = editHandler.getDataSource();
        }
        if( dataSource ) {
            for( let propIn of autoAssignableProps ) {
                let updatedProp = { ...propIn };
                updatedProp.dbValue = '';
                updatedProp.value = '';

                dataSource.replaceValuesWithNewValues( [ updatedProp ] );
                if( propIn.onChange ) {
                    propIn.onChange( {
                        target: {
                            value: ''
                        }
                    } );
                }
            }
        }
    } );
};

/**
 * Auto-assign a single property.
 *
 * @param {Object} prop - The property to be auto-assigned
 * @param {String} operationType - The operation type, must be 'CREATE', 'REVISE', or 'SAVEAS'
 * @param {String} pattern - The pattern to be used for auto-assign; may be empty string
 * @param {Object} sourceObject - The source model object; must be set for 'REVISE' and 'SAVEAS' operation types
 */
export let autoAssignProperty = function( prop, operationType, pattern, sourceObject, createType, editHandler ) {
    var deferred = AwPromiseService.instance.defer();
    const revisionString = 'Revision';

    if( prop && prop.fielddata && !prop.fielddata.isAutoAssignable ) {
        logger.warn( 'autoAssignService.autoAssignProperty: property is not auto-assignable!!' );
        return;
    }

    // Prepare SOA input
    // 1. operation type
    var opType = _getOpType( operationType );
    if( opType === null ) {
        logger.warn( 'autoAssignService.autoAssignProperty: unknown operation type!!' );
        return;
    }

    // 2. pattern
    var propName = prop.fielddata.propertyName;

    // Deal with propNames in the following format: REF(revision,ItemRevisionCreI).item_revision_id
    let owningType = _getOwningType( prop );
    if( propName.startsWith( 'REF' ) ) {
        propName = propName.substring( propName.indexOf( '.' ) + 1 );
        if( operationType === 'CREATE' ) {
            owningType = `${owningType}${revisionString}`;
        } else if( operationType === 'SAVEAS' && owningType?.endsWith( revisionString ) ) {
            owningType = owningType.substring( 0, owningType.indexOf( revisionString ) ).trim();
        }
    }

    var propNameWithPattern = {};
    if( pattern ) {
        // A new pattern is supplied, use it
        propNameWithPattern[ propName ] = pattern;
    } else if( prop.fielddata.preferredPattern && _.isString( prop.fielddata.preferredPattern ) ) {
        propNameWithPattern[ propName ] = prop.fielddata.preferredPattern;
    }  else if( prop.fielddata.selectedPattern && _.isString( prop.fielddata.selectedPattern ) ) {
        // No new pattern is given, use teh selected pattern on prop
        propNameWithPattern[ propName ] = prop.fielddata.selectedPattern;
    } else if( _.isArray( prop.fielddata.patterns ) ) {
        // No new pattern is given, use one form pattern map
        propNameWithPattern[ propName ] = prop.fielddata.patterns[ 0 ];
    } else {
        propNameWithPattern[ propName ] = '';
    }

    var input = {
        operationType: opType,
        propertyNameWithSelectedPattern: propNameWithPattern
    };

    // 3. The BO type (i.e. the owning type of the prop)
    input.businessObjectName = owningType;

    // 4. For Revise and SaveAs, add source object
    if( opType === 2 || opType === 3 ) {
        if( sourceObject ) {
            input.additionalInputParams = {
                sourceObject: sourceObject.uid
            };
        } else {
            logger.warn( 'autoAssignService.autoAssignProperty: source object not specified!!' );
            return;
        }
    }

    var inputData = {
        generateNextValuesIn: [ input ]
    };

    // If prop is 'item_revision_id' has revision naming rule attached, use already generated pattern
    // If hasRevRuleAttached is only condition , then case where both naming rule and revision naming rules
    // are attached would fail
    if( propName === 'item_revision_id' && prop.fielddata && prop.fielddata.hasRevRuleAttached ) {
        prop.dbValue = pattern;
        prop.preferredPattern = pattern;
    } else {
        soaSvc.post( 'Core-2013-05-DataManagement', 'generateNextValues', inputData ).then( function( response ) {
            if( response.generatedValues[ 0 ].generatedValues[ propName ].errorCode === 0 ) {
                let nextValue = response.generatedValues[ 0 ].generatedValues[ propName ].nextValue;

                let dataSource;
                if( editHandler ) {
                    dataSource = editHandler.getDataSource();
                    let autoAssignableProperties = dataSource.getAllAutoAssignableProperties();

                    let prop2 = autoAssignableProperties.filter( function( autoAssignProp ) {
                        if(  autoAssignProp && autoAssignProp.propertyName === prop.fielddata.propertyName
                          ||  autoAssignProp.fielddata && autoAssignProp.fielddata.propertyName === prop.fielddata.propertyName  ) {
                            return autoAssignProp;
                        }
                    } );
                    prop2[0].preferredPattern = pattern;

                    let updatedProp = { ...prop2[0] };
                    updatedProp.dbValue = nextValue;
                    updatedProp.value = nextValue;

                    dataSource.replaceValuesWithNewValues( [ updatedProp ] );
                    if( prop2.onChange ) {
                        prop2.onChange( {
                            target: {
                                value: nextValue
                            }
                        } );
                    }

                    deferred.resolve( nextValue );
                }
            } else {
                // LCS-637172 Blank out the property value if server returns error
                let dataSource;
                if( editHandler ) {
                    dataSource = editHandler.getDataSource();
                    let autoAssignableProperties = dataSource.getAllAutoAssignableProperties();

                    let prop2 = autoAssignableProperties.filter( function( autoAssignProp ) {
                        if(  autoAssignProp && autoAssignProp.propertyName === prop.fielddata.propertyName
                          ||  autoAssignProp.fielddata && autoAssignProp.fielddata.propertyName === prop.fielddata.propertyName  ) {
                            return autoAssignProp;
                        }
                    } );
                    prop2[0].preferredPattern = pattern;

                    let updatedProp = { ...prop2[0] };
                    updatedProp.dbValue = '';
                    updatedProp.value = '';

                    dataSource.replaceValuesWithNewValues( [ updatedProp ] );
                    if( prop2.onChange ) {
                        prop2.onChange( {
                            target: {
                                value: ''
                            }
                        } );
                    }

                    deferred.resolve( '' );
                }
                logger.error( 'autoAssignService.autoAssignProperty: Auto assign failed due to errorCode ' +
                    response.generatedValues[ 0 ].generatedValues[ propName ].errorCode );
            }
        } ).catch( function( error ) {
            handlePartialError( error );
            // LCS-637172 Blank out the property value if server returns error
            let dataSource;
            if( editHandler ) {
                dataSource = editHandler.getDataSource();
                let autoAssignableProperties = dataSource.getAllAutoAssignableProperties();

                let prop2 = autoAssignableProperties.filter( function( autoAssignProp ) {
                    if(  autoAssignProp && autoAssignProp.propertyName === prop.fielddata.propertyName
                        ||  autoAssignProp.fielddata && autoAssignProp.fielddata.propertyName === prop.fielddata.propertyName  ) {
                        return autoAssignProp;
                    }
                } );
                prop2[0].preferredPattern = pattern;

                let updatedProp = { ...prop2[0] };
                updatedProp.dbValue = '';
                updatedProp.value = '';

                dataSource.replaceValuesWithNewValues( [ updatedProp ] );
                if( prop2.onChange ) {
                    prop2.onChange( {
                        target: {
                            value: ''
                        }
                    } );
                }

                deferred.resolve( '' );
            }
        } );
    }

    return deferred.promise;
};

var handlePartialError = function( error ) {
    if( error && error.cause && error.cause.partialErrors && error.cause.partialErrors.length > 0 ) {
        const partialErrors = error.cause.partialErrors;
        if( partialErrors[ 0 ] && partialErrors[ 0 ].errorValues && partialErrors[ 0 ].errorValues.length > 0 ) {
            let errorMessage = '';
            _.forEach( partialErrors[ 0 ].errorValues, function( errorValue ) {
                errorMessage = errorMessage + errorValue.message;
            } );
            messagingService.showError( errorMessage );
        }
    }
};

export default exports = {
    autoAssignAllProperties,
    autoAssignProperty
};
