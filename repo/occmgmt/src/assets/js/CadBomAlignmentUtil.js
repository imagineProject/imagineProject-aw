// Copyright (c) 2022 Siemens

/**
 * @module js/CadBomAlignmentUtil
 */
import AwPromiseService from 'js/awPromiseService';
import appCtxSvc from 'js/appCtxService';
import AwStateService from 'js/awStateService';
import _ from 'lodash';


/**
 * Check if in ACE Sublocation or outside ACE
 * @returns {boolean} - true if in ACE Sublocation  else false
 */
export let isACESublocation = function() {
    let aceContextsSubLocations = [ 'com.siemens.splm.client.occmgmt:OccurrenceManagementSubLocation',
        'com.siemens.splm.client.cba.CADBOMAlignment:CBASublocation'
    ];

    if( appCtxSvc.ctx.locationContext &&
        aceContextsSubLocations.includes( appCtxSvc.ctx.locationContext[ 'ActiveWorkspace:SubLocation' ] ) ) {
        let activeContext = appCtxSvc.getCtx( 'aceActiveContext.context' );
        if( activeContext && activeContext.pwaSelection && !_.isEmpty( activeContext.pwaSelection ) ) {
            return true;
        }
    }
    return false;
};

/**
 * Get primary selection
 * @returns {occContext} - occContext  object.
 * @returns {object} - Returns primary object.
 */
export let getPrimarySelection = function( occContext ) {
    if( exports.isACESublocation() ) {
        return occContext ? occContext.pwaSelection[0] : appCtxSvc.getCtx( 'pselected' );
    }
    return appCtxSvc.getCtx( 'xrtSummaryContextObject' );
};

/**
 *
 * Get URL parameter from Fnd0Message dataset object
 * @param {object} datasetObject - Fnd0Message dataset object containing URL
 */

export let getURLParametersFromDataset = function( datasetObject ) {
    let toParams = {};
    if( datasetObject.props && datasetObject.props.fnd0MessageBody ) {
        let str = datasetObject.props.fnd0MessageBody.dbValues[ '0' ];

        let paramMap = {};
        let temp = str.split( '?' );
        let uidArray = temp[ 1 ].split( '&' );
        _.forEach( uidArray, function( key ) {
            let arr = key.split( '=' );
            paramMap[ arr[ 0 ] ] = arr[ 1 ];
        } );

        toParams.uid = paramMap.uid;
        toParams.c_uid = paramMap.c_uid;
        toParams.c_uid2 = paramMap.c_uid2;
        toParams.o_uid = paramMap.o_uid;
        toParams.o_uid2 = paramMap.o_uid2;
        toParams.src_uid = paramMap.uid;
        toParams.spci_uid = paramMap.pci_uid;
        toParams.pci_uid = paramMap.pci_uid;
        toParams.uid2 = paramMap.uid2;
        toParams.trg_uid = paramMap.uid2;
        toParams.tpci_uid = paramMap.pci_uid2;
        toParams.pci_uid2 = paramMap.pci_uid2;
        toParams.isRL_mode = paramMap.isRL_mode;
        //Str contains the URL with parameters uid,uid2,src_uid and trg_uid, so remaining parameters are set as undefined.
    }
    return toParams;
};

/**
 * Get aligned object for selected object
 *
 * @param {string} selectedObjectUid - selected object UID for which aligned object to find
 * @param {string} context - Source or Target context in which aligned object to find
 * @returns{Array} - Array of  UID of aligned objects found.
 */
export let getAlignedObjects = function( selectedObjectUid, context ) {
    let alignedObjects = [];
    let alignmentCheckInfo = appCtxSvc.getCtx( 'cbaContext.alignmentCheckContext.alignmentCheckInfo' );
    if( alignmentCheckInfo && alignmentCheckInfo[ context ] ) {
        let differences = alignmentCheckInfo[ context ].differences;
        let differenceObj = differences && differences[ selectedObjectUid ] ? differences[ selectedObjectUid ] : null;
        alignedObjects = differenceObj && differenceObj.mappingUids ? differenceObj.mappingUids : [];
    }
    return alignedObjects;
};

/**
 * Get property value for specified path from given object
 *
 * @param {object} object - object from which property value to extract
 * @param {string} propertyPath - property path in object to fetch value
 * @returns {object} - value of the property , if property not found then return undefined
 */
export let getPropertyValueFromObject = function( object, propertyPath ) {
    return propertyPath.split( '.' ).reduce( function( iv, cv ) {
        return typeof iv === 'undefined' || iv === null ? iv : iv[ cv ];
    }, object );
};

/**
 * Check if selected primary object id exist in list of secondary object
 *
 * @param {object} awb0PrimaryObject - selected primary object
 * @param {Array} secondaryObjects - secondary object list
 * @returns{boolean} - true if primary object exist in secondary object list else return false
 */
export let isSelectedObjectExistInList = function( awb0PrimaryObject, secondaryObjects ) {
    let matchFound;
    if( awb0PrimaryObject && awb0PrimaryObject.props && Array.isArray( secondaryObjects ) && secondaryObjects.length > 0 ) {
        let awb0UnderlyingObject = exports.getPropertyValueFromObject( awb0PrimaryObject, 'props.awb0UnderlyingObject' );
        if( awb0UnderlyingObject ) {
            let underlyingObjUid = awb0UnderlyingObject.dbValues[ 0 ];

            matchFound = secondaryObjects.find( fndObj => {
                return fndObj.uid === underlyingObjUid;
            } );

            if( !matchFound ) {
                matchFound = secondaryObjects.find( fndObj => {
                    let fnd0UnderlyingObjectUid = exports.getPropertyValueFromObject( fndObj, 'props.fnd0UnderlyingObject.dbValue' );
                    return fnd0UnderlyingObjectUid === underlyingObjUid;
                } );
            }
        }
    }
    return Boolean( matchFound );
};

/**
 * Check if given objects are solution variant objects.
 * @param {object} objectList - object list to validate
 *
 * @return {object} - returns invalid objects with error message key.
 */

let _isSolutionVariantObject = function( objectList ) {
    let output = {};

    _.forEach( objectList, function( object ) {
        let isObjectVI = getPropertyValueFromObject( object, 'props.is_vi' );
        if( isObjectVI && isObjectVI.dbValues[ 0 ] === '1' ) {
            if( !output.InvalidObjectTypeForAlignment ) {
                output.InvalidObjectTypeForAlignment = [];
            }
            output.InvalidObjectTypeForAlignment.push( object );
        }
    } );
    return output;
};

/**
 * Check if the given objects are invalid to open in CBA.
 * @param {Object} objectList - object List to check.
 * @param {Object} invalidTypes - invalid object List.
 *
 * @returns {Promise} After validation return promise with invalid object and message key.
 */
export let isInvalidObjectsForCBA = function( objectList, invalidTypes ) {
    let deferred = AwPromiseService.instance.defer();
    let output = {};

    if( invalidTypes.length !== 0 ) {
        output.invalidTypes = invalidTypes;
        deferred.resolve( output );
    } else {
        let result = _isSolutionVariantObject( objectList );
        let errorMessageKeys = Object.keys( result );
        if( errorMessageKeys.length ) {
            output.invalidTypes = invalidTypes.concat( result[ errorMessageKeys[ 0 ] ] );
            output.errorMessageKey = errorMessageKeys[ 0 ];
        }
        deferred.resolve( output );
    }

    return deferred.promise;
};

/**
 * Checks if Part/Design selected from Overview tab
 * @param {String} selectedObject - selected object
 * @return {Boolean} true if type is Fnd0AlignedPart or Fnd0AlignedDesign
 */
export let isAlignedDesignOrPartSelected = function( selectedObject ) {
    let typeHierarchyArray = _.get( selectedObject, 'modelType.typeHierarchyArray' );

    if ( typeHierarchyArray && ( typeHierarchyArray.indexOf( 'Fnd0AlignedPart' ) > -1 || typeHierarchyArray.indexOf( 'Fnd0AlignedDesign' ) > -1 ) ) {
        return true;
    }
    return false;
};
/**
  * Update the URL based on input parameters.
  *
  * @param {Object} inputData - Parameters that needs to be added in URL.
  */
export let updateURLParams = function( inputData ) {
    AwStateService.instance.go( AwStateService.instance.current.name, inputData );
};

/**
 * Convert the string to boolean value
 * @param {string} parameter - Parameter which needs to be converted in boolean
 * @returns {boolean} - Boolean value of parameter
 */
let _getBooleanValue = function( parameter ) {
    let value = typeof parameter === 'boolean' ? parameter : parameter.toUpperCase() === 'TRUE';
    return Boolean( value );
};
/**
  * update the toggle values.
  * @param {object} toggleData -Toggle data which needs to be updated
  * @param {stateParam}stateParam - State parameter
  * @return {object} Updated toggle data
  */
export let updateToggleDataValues = function( toggleData, stateParam ) {
    let clonedToggleData = _.clone( toggleData );
    let stateParamValue = appCtxSvc.getCtx( 'state.params.' + stateParam );
    if( stateParamValue !== undefined && clonedToggleData ) {
        let newValue =   _getBooleanValue( stateParamValue );
        clonedToggleData.dbValue = newValue;
        clonedToggleData.dbValues[ 0 ] = newValue;
        clonedToggleData.value = newValue;
        clonedToggleData.valueUpdated = true;
    }
    return clonedToggleData;
};


/**
 * Convert the parameter to Boolean
 *
 * @param {object} parameter - parameter
 * @returns {boolean} - Convert the parameter to Boolean
 */
export let getBooleanValue = function( parameter ) {
    let value;
    if ( !parameter ) {
        value = false;
    } else {
        let typeParameter = typeof parameter;
        switch( typeParameter ) {
            case 'boolean':
                value = parameter;
                break;
            case 'string':
                value =  parameter.toUpperCase() === 'TRUE';
                break;
            case 'object':
                value =  true;
                break;
            case 'number':
                value =  parameter !== 0;
                break;
            default:
                value = false;
        }
    }

    return value;
};

/**
 * CAD-BOM Alignment Util
 */

const exports = {
    getPrimarySelection,
    getURLParametersFromDataset,
    getAlignedObjects,
    isSelectedObjectExistInList,
    getPropertyValueFromObject,
    isACESublocation,
    isInvalidObjectsForCBA,
    isAlignedDesignOrPartSelected,
    getBooleanValue,
    updateURLParams,
    updateToggleDataValues
};
export default exports;
