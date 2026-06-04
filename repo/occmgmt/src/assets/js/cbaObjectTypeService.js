// Copyright (c) 2022 Siemens

/**
 * Service to handle object type related functionality
 * @module js/cbaObjectTypeService
 */
import AwPromiseService from 'js/awPromiseService';
import _ from 'lodash';
import constantsService from 'soa/constantsService';
import cbaConstants from 'js/cbaConstants';
import appCtxSvc from 'js/appCtxService';
import adapterSvc from 'js/adapterService';
import CadBomAlignmentUtil from 'js/CadBomAlignmentUtil';
import CadBomOccurrenceAlignmentUtil from 'js/CadBomOccurrenceAlignmentUtil';

/**
 * Create input for BO Constant check SOA
 * @param {List} objectList The list of objects to check
 * @returns {Array} The list of objects
 */
let _createCheckBOTypeInput = function( objectList ) {
    let constantNameToCheck = cbaConstants.PART_DESIGN_QUALIFIER;
    let constantTypesToCheck = [];

    _.forEach( objectList, function( object ) {
        if( object && object.type ) {
            constantTypesToCheck.push( {
                typeName: object.type,
                constantName: constantNameToCheck
            } );
        }
    } );
    return constantTypesToCheck;
};

/**
 * Check Business object type
 * @param {List} constantTypesToCheck  List of constant type to check
 * @returns {object} Object contains separate map for designs, parts and products
 */
let _checkBOType = function( constantTypesToCheck ) {
    let deferred = AwPromiseService.instance.defer();
    let output = {};
    constantsService.getTypeConstantValues( constantTypesToCheck ).then( function( response ) {
        if( response && response.constantValues && response.constantValues.length > 0 ) {
            let designTypes = [];
            let partTypes = [];
            let productTypes = [];

            let typeConstantValues = response.constantValues;

            _.forEach( typeConstantValues, function( constantValue ) {
                let constantKey = constantValue.key;
                let constantName = constantKey.constantName;

                if( constantName === cbaConstants.PART_DESIGN_QUALIFIER ) {
                    if( constantValue.value === cbaConstants.DESIGN ) {
                        designTypes.push( constantKey.typeName );
                    } else if( constantValue.value === cbaConstants.PART ) {
                        partTypes.push( constantKey.typeName );
                    } else if( constantValue.value === cbaConstants.PRODUCT_EBOM ) {
                        productTypes.push( constantKey.typeName );
                    }
                    let partDesignQualifierType = appCtxSvc.getCtx( cbaConstants.CTX_PATH_PART_DESIGN_QUALIFIER + '.' + constantKey.typeName );
                    if( !partDesignQualifierType ) {
                        appCtxSvc.updatePartialCtx( cbaConstants.CTX_PATH_PART_DESIGN_QUALIFIER + '.' + constantKey.typeName, constantValue.value );
                    }
                }
            } );

            output.designTypes = designTypes;
            output.partTypes = partTypes;
            output.productTypes = productTypes;
            deferred.resolve( output );
        }
    } );
    return deferred.promise;
};

/**
 * Get Design and Part from input list if any available.
 * @param {List} objectList List of objects to check
 * @returns {Object} Returns a object which hold designTypes, PartTypes and productTypes separated opbject
 */
export let getDesignsAndParts = function( objectList ) {
    let defer = AwPromiseService.instance.defer();

    let designTypes = [];
    let partTypes = [];
    let productTypes = [];

    let constantTypesToCheck = _createCheckBOTypeInput( objectList );

    let promise = _checkBOType( constantTypesToCheck );
    promise.then( function( result ) {
        let objectTypeMap = result;

        _.forEach( objectList, function( object ) {
            if( objectTypeMap.designTypes.includes( object.type ) ) {
                designTypes.push( object );
            } else if( objectTypeMap.partTypes.includes( object.type ) ) {
                partTypes.push( object );
            } else if( objectTypeMap.productTypes.includes( object.type ) ) {
                productTypes.push( object );
            }
        } );
        let output = {
            designTypes: designTypes,
            partTypes: partTypes,
            productTypes: productTypes
        };
        defer.resolve( output );
    } );
    return defer.promise;
};

/**
 * check whether the object is having given type i.e. qualifier type
 * @param {*} object - Object
 * @param {*} type - Type can be Design/Part/Product
 * @returns {Boolean} - True if the object is having given type, otherwise false
 */
export let isObjectOfGivenType = function( object, type ) {
    let constantValue = object && object.type ? appCtxSvc.getCtx( cbaConstants.CTX_PATH_PART_DESIGN_QUALIFIER + '.' + object.type ) : null;
    let result;
    let defer = AwPromiseService.instance.defer();

    if( !constantValue ) {
        let objectList = [ object ];
        let constantTypesToCheck = _createCheckBOTypeInput( objectList );

        let promise = constantsService.getTypeConstantValues( constantTypesToCheck );
        promise.then( function( response ) {
            let constantValue = null;
            if( response ) {
                let constantValues = _.get( response, 'constantValues' );
                constantValue = constantValues && constantValues.length > 0 && constantValues[0].value ? constantValues[0].value : constantValue;
            }
            let result = constantValue === type;
            defer.resolve( result );
        } );
    } else {
        result = constantValue === type;
        defer.resolve( result );
    }
    return defer.promise;
};

/**
 * Get object qualifier type
 * @param {object} object - Object to check
 * @returns {string} - Object qualifier type
 */
export let getObjectQualifierType = function( object ) {
    if( !object ) {
        return null;
    }
    let preferences = _.get( appCtxSvc, 'ctx.preferences' );
    let objectQualifierType = null;
    if( preferences ) {
        let adaptedObject = adapterSvc.getAdaptedObjectsSync( [ object ] )[ 0 ];
        if ( preferences.FND0_DESIGNREVISION_TYPES && preferences.FND0_DESIGNREVISION_TYPES.includes( adaptedObject.type ) ) {
            objectQualifierType = cbaConstants.DESIGN;
        } else if( preferences.FND0_PARTREVISION_TYPES && preferences.FND0_PARTREVISION_TYPES.includes( adaptedObject.type ) ) {
            objectQualifierType = cbaConstants.PART;
        } else if( preferences.FND0_PRODUCTEBOMREVISION_TYPES && preferences.FND0_PRODUCTEBOMREVISION_TYPES.includes( adaptedObject.type ) ) {
            objectQualifierType = cbaConstants.PRODUCT_EBOM;
        } else if( preferences.FND0_MULTIDOMAINPARTORDESIGNREVISION_TYPES && preferences.FND0_MULTIDOMAINPARTORDESIGNREVISION_TYPES.includes( adaptedObject.type ) ) {
            objectQualifierType = cbaConstants.MULTI_DOMAIN_PART_OR_DESIGN;
        }
    }
    return objectQualifierType;
};


/**
 * Get objects qualifier type map
 * @param {object} objects - Object to check
 * @returns {Map} - Object qualifier type
 */
export let getObjectsQualifierType = function( objects ) {
    let qualifierToObjMap = {};
    if( !objects ) {
        return null;
    }
    let preferences = _.get( appCtxSvc, 'ctx.preferences' );

    if( preferences ) {
        _.forEach( objects, function( object ) {
            let objectQualifierType = null;
            let adaptedObject = adapterSvc.getAdaptedObjectsSync( [ object ] )[ 0 ];
            if ( preferences.FND0_DESIGNREVISION_TYPES && preferences.FND0_DESIGNREVISION_TYPES.includes( adaptedObject.type ) ) {
                objectQualifierType = cbaConstants.DESIGN;
            } else if( preferences.FND0_PARTREVISION_TYPES && preferences.FND0_PARTREVISION_TYPES.includes( adaptedObject.type ) ) {
                objectQualifierType = cbaConstants.PART;
            } else if( preferences.FND0_PRODUCTEBOMREVISION_TYPES && preferences.FND0_PRODUCTEBOMREVISION_TYPES.includes( adaptedObject.type ) ) {
                objectQualifierType = cbaConstants.PRODUCT_EBOM;
            } else if( preferences.FND0_MULTIDOMAINPARTORDESIGNREVISION_TYPES && preferences.FND0_MULTIDOMAINPARTORDESIGNREVISION_TYPES.includes( adaptedObject.type ) ) {
                objectQualifierType = cbaConstants.MULTI_DOMAIN_PART_OR_DESIGN;
            }

            if( !qualifierToObjMap[ objectQualifierType ] ) {
                qualifierToObjMap[ objectQualifierType ] = [];
            }

            qualifierToObjMap[ objectQualifierType ].push( object );
        } );
    }
    return qualifierToObjMap;
};

/**
  * Get mapped type for the selected object based on pma0_part_design_type preference
  *
  * @param {string} context - context
  * @param {string} defaultType - default type to consider if no pma0_part_design_type preference is defined or have the selected object mapping in it
  * @returns {string} - mapped type to selected object in Pma0_Part_Design_Type preference or default type (first value from FND0_PART_TYPES or FND0_DESIGN_TYPES preference)
  */
export let getPreferredType = function( context, defaultType ) {
    let prefValues = appCtxSvc.getCtx( 'preferences.Pma0_Part_Design_Type' );
    if ( prefValues ) {
        let primaryObj = CadBomAlignmentUtil.getPrimarySelection( context );
        let selectedObjectTypeName = CadBomOccurrenceAlignmentUtil.getSelectedObjectTypeName( primaryObj );
        if ( !_.isEmpty( selectedObjectTypeName ) ) {
            for ( const prefValue of prefValues ) {
                // Split the string by comma and colon to separate key-value pairs
                const partDesignTypeValues = prefValue.split( ',' );

                let partDesignTypeArr = [];
                // Iterate through key-value pairs to extract values for "partTypeName" and "designTypeName"
                // keyValuePairs will be in format PartType:Part and DesignType:Design
                _.forEach( partDesignTypeValues, ( partDesignTypeValues ) => {
                    // keyValuePairs will be [partTypeName, Part] or [designTypeName, Design]
                    const keyValuePairs = partDesignTypeValues.split( ':' );

                    // partDesignTypeArr will be [Part, Design]
                    // keyValuePairs[1] will be Part or Design
                    partDesignTypeArr.push( keyValuePairs[1] );
                } );

                // Check if selected object type is part or design
                if ( partDesignTypeArr.includes( selectedObjectTypeName ) ) {
                    let designTypes = appCtxSvc.getCtx( 'preferences.FND0_DESIGN_TYPES' );
                    // if selected object type is Design then return first value from partDesignTypeArr which is Part
                    if ( designTypes?.includes( selectedObjectTypeName ) ) {
                        return partDesignTypeArr[0];
                    }
                    // if selected object type is Part then return second value from partDesignTypeArr which is Design
                    if( partDesignTypeArr.length > 1 ) {
                        return partDesignTypeArr[1];
                    }
                }
            }
        }
    }
    // if pref pma0_part_design_type is not defined or no mapping found for selected object then return default type
    // this way we are not forcing user to have pma0_part_design_type preference defined they can still have the configuration
    // to set the default type based on the preference FND0_PART_TYPES and FND0_DESIGN_TYPES values
    return defaultType ? defaultType : '';
};

const exports = {
    getDesignsAndParts,
    isObjectOfGivenType,
    getObjectQualifierType,
    getObjectsQualifierType,
    getPreferredType
};

export default exports;
