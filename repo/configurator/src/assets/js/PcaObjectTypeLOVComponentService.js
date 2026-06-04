// Copyright (c) 2022 Siemens

/**
 * @module js/PcaObjectTypeLOVComponentService
 */

import appCtxService from 'js/appCtxService';
import AwLovEdit from 'viewmodel/AwLovEditViewModel';
import { constants as veConstants } from 'js/pca0VariabilityExplorerConstants';
import pca0Constants from 'js/Pca0Constants';
import _ from 'lodash';

let exports = {};

/**
 * Render function for AwLovEdit
 * @param {Object} props context for render function interpolation
 * @returns {JSX.Element} React component
 */
export const awPcaObjectTypeLOVComponentRenderFunction = ( props ) => {
    const { viewModel, ...prop } = props;
    let fielddata = { ...prop.fielddata };
    fielddata.hasLov = true;
    fielddata.dataProvider = viewModel.dataProviders.objTypeProvider;
    const passedProps = { ...prop, fielddata };
    return (
        <AwLovEdit {...passedProps} ></AwLovEdit>
    );
};

/**
 * Build SOA input for Family BO to get the list of applicable/instantiable BO types
 * @returns {object} BO type and exclusion list
 */
export const getInputForApplicableFamilyTypes = () => {
    let exclusionList = [
        'Cfg0AbsFeature', // Not supported
        'Cfg0AbsEffectivityFamily', // Not supported
        'Cfg0AbsFeatureSet', // Not supported
        'Cfg0AbsModelFamily' // Not supported
    ];

    // If Dynamic family authoring is not supported then adding it to the exclusion list.
    const isDynamicFamilySupported = appCtxService.getCtx( 'preferences.Cfg0EnableDynamicFamilySupport' );
    if ( !isDynamicFamilySupported || isDynamicFamilySupported[0].toLowerCase() === 'false' ) {
        exclusionList.push( pca0Constants.CFG_OBJECT_TYPES.ABS_FEATURE_FAMILY );
    }

    return {
        boType: 'Cfg0AbsFamily',
        exclusionList: exclusionList
    };
};

/**
 * Build SOA input to get the list of applicable/instantiable BO types
 * @param {String} selectedType entity object to query
 * @returns {Array} list of input data with detail on requested BO type and exclusion list
 */
export let getInputForApplicableTypes = function( selectedType ) {
    let inputDataList = [];
    let boType = '';
    let exclusionList = [];
    switch ( selectedType ) {
        case pca0Constants.CFG_OBJECT_TYPES.ABS_FAMILY_GROUP:
            boType = pca0Constants.CFG_OBJECT_TYPES.ABS_FAMILY_GROUP;
            exclusionList = [];
            break;
        case pca0Constants.CFG_OBJECT_TYPES.ABS_LITERAL_VALUE_FAMILY:
        case pca0Constants.CFG_OBJECT_TYPES.ABS_FEATURE_FAMILY:
        case pca0Constants.CFG_OBJECT_TYPES.ABS_SUMMARY_OPTION_FAMILY:
        case pca0Constants.CFG_OBJECT_TYPES.ABS_PACKAGE_OPTION_FAMILY:{
            ( { boType, exclusionList } = exports.getInputForApplicableFamilyTypes() );
            break;
        }
        case pca0Constants.CFG_OBJECT_TYPES.ABS_FEATURE:
            boType = pca0Constants.CFG_OBJECT_TYPES.ABS_FEATURE;
            exclusionList = [ ];
            break;
        case pca0Constants.CFG_OBJECT_TYPES.TYPE_REVISION:
            boType = 'Cfg0AbsLiteralOptionValue';
            exclusionList = [
                'Cfg0AbsModel', // Not supported
                'Cfg0AbsEffectivityIntent', // Not supported
                'Cfg0AbsCompoundOptionValue' // Not supported
            ];
            break;
        case pca0Constants.CFG_OBJECT_TYPES.ABS_SUMMARY_OPTION_VALUE:
            boType = pca0Constants.CFG_OBJECT_TYPES.ABS_SUMMARY_OPTION_VALUE;
            break;
        case pca0Constants.CFG_OBJECT_TYPES.ABS_PACKAGE_OPTION_VALUE:
            boType = pca0Constants.CFG_OBJECT_TYPES.ABS_PACKAGE_OPTION_VALUE;
            break;
        case veConstants.CFG_OBJECT_TYPES.ABS_CONSTRAINT_RULE: {
            boType = 'Cfg0AbsRule';
            exclusionList = [
                'Cfg0AbsPackageRule', // Not supported
                'Cfg0AbsFreeFormRule', // Not supported
                'Cfg0AbsFeasibilityRule', // Deprecated
                'Cfg0AbsMatrixRule' // Not supported
            ];
            const isContextPositiveBiased = appCtxService.getCtx( veConstants.CONFIG_CONTEXT_KEY ).isContextPositiveBiased;
            isContextPositiveBiased && exclusionList.push( veConstants.CFG_OBJECT_TYPES.ABS_AVAILABILITY_RULE );

            // If Dynamic family authoring is not supported then adding Exception rule the exclusion list.
            const isDynamicFamilySupported = appCtxService.getCtx( 'preferences.Cfg0EnableDynamicFamilySupport' );
            if ( !isDynamicFamilySupported || isDynamicFamilySupported[0].toLowerCase() === 'false' ) {
                exclusionList.push( veConstants.CFG_OBJECT_TYPES.ABS_EXCEPTION_RULE );
            }

            // If we are in Configurator Dictionary then adding Arithmetic Constraint to the exclusion list.
            if( appCtxService.getCtx( veConstants.CONFIG_CONTEXT_KEY ).openedObjectType === pca0Constants.CFG_OBJECT_TYPES.TYPE_DICTIONARY ) {
                exclusionList.push( 'Cfg0AbsArithmeticConstraint' );
            }
            break;
        }
        case 'allConstraintRules': {
            boType = 'Cfg0AbsRule';
            exclusionList = [
                'Cfg0AbsPackageRule', // Not supported
                'Cfg0AbsFeasibilityRule' // Deprecated
            ];
            const isContextPositiveBiased = appCtxService.getCtx( veConstants.CONFIG_CONTEXT_KEY ).isContextPositiveBiased;
            isContextPositiveBiased && exclusionList.push( veConstants.CFG_OBJECT_TYPES.ABS_AVAILABILITY_RULE );

            // If Dynamic family authoring is not supported then adding Exception rule the exclusion list.
            const isDynamicFamilySupported = appCtxService.getCtx( 'preferences.Cfg0EnableDynamicFamilySupport' );
            if ( !isDynamicFamilySupported || isDynamicFamilySupported[0].toLowerCase() === 'false' ) {
                exclusionList.push( veConstants.CFG_OBJECT_TYPES.ABS_EXCEPTION_RULE );
            }
            break;
        }
        case veConstants.CFG_OBJECT_TYPES.ABS_MATRIX_RULE: {
            boType = 'Cfg0AbsRule';
            exclusionList = [
                'Cfg0AbsPackageRule', // Not supported
                'Cfg0AbsFreeFormRule', // Not supported
                'Cfg0AbsFeasibilityRule', // Deprecated
                'Cfg0AbsAvailabilityRule', // Not supported
                'Cfg0AbsExceptionRule', // Not supported
                'Cfg0AbsDefaultRule', // Not supported
                'Cfg0AbsExcludeRule', // Not supported
                'Cfg0AbsIncludeRule', // Not supported
                'Cfg0AbsArithmeticConstraint' // Not supported
            ];
            break;
        }
        case veConstants.CFG_OBJECT_TYPES.ABS_FREEFORM_RULE: {
            boType = 'Cfg0AbsFreeFormRule';
            break;
        }
        case pca0Constants.CFG_OBJECT_TYPES.ABS_PRODUCT_MODEL_FAMILY:
        case pca0Constants.CFG_OBJECT_TYPES.ABS_SUMMARY_MODEL_FAMILY:
        case pca0Constants.CFG_OBJECT_TYPES.ABS_PRODUCT_LINE_FAMILY:
            boType = 'Cfg0AbsModelFamily';
            break;
        case pca0Constants.CFG_OBJECT_TYPES.TYPE_PRODUCT_MODEL:
            boType = pca0Constants.CFG_OBJECT_TYPES.TYPE_PRODUCT_MODEL;
            break;
        case pca0Constants.CFG_OBJECT_TYPES.ABS_SUMMARY_MODEL:
            boType = pca0Constants.CFG_OBJECT_TYPES.ABS_SUMMARY_MODEL;
            break;
        case pca0Constants.CFG_OBJECT_TYPES.ABS_PRODUCT_LINE:
            boType = pca0Constants.CFG_OBJECT_TYPES.ABS_PRODUCT_LINE;
            break;
        default:
            break;
    }

    let inputData = {
        boTypeName: boType,
        exclusionBOTypeNames: exclusionList
    };

    inputDataList.push( inputData );
    return inputDataList;
};

/**
 * Post process the SOA response and get the list of applicable BO types
 * @param {Object} response SOA response to be processed
 * @return {Array} list of applicable BO types
 */
export let processSoaResponseForBOTypes = function( response ) {
    let boTypes = [];
    if( response.output ) {
        for( let ii = 0; ii < response.output.length; ii++ ) {
            let displayableBOTypeNames = response.output[ ii ].displayableBOTypeNames;
            for( let jj = 0; jj < displayableBOTypeNames.length; jj++ ) {
                let boType = {
                    propDisplayValue: displayableBOTypeNames[ jj ].boDisplayName,
                    dispValue: displayableBOTypeNames[ jj ].boDisplayName,
                    propInternalValue: displayableBOTypeNames[ jj ].boName
                };
                boTypes.push( boType );
            }
        }
    }
    return boTypes;
};

/**
 * returns the existing lov's from cache, either from the parent's cache or the current one in case of component still being alive
 * @param {Array} listVals - list of values
 * @param {Array} objectTypesCachedValues - Cached object types
 * @return {Array} list of vals
 */
export let getApplicableObjectTypesFromCache = function( listVals, objectTypesCachedValues ) {
    return listVals ? listVals : objectTypesCachedValues;
};

export default exports = {
    awPcaObjectTypeLOVComponentRenderFunction,
    getInputForApplicableFamilyTypes,
    getInputForApplicableTypes,
    processSoaResponseForBOTypes,
    getApplicableObjectTypesFromCache
};
