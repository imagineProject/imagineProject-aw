/* eslint-disable sonarjs/cognitive-complexity */
/* eslint-disable complexity */
// Copyright (c) 2022 Siemens

/**
 * propertyLoader.js
 *
 * Responsible for updating existing ViewModelTreeNodes after property
 * values have been fetched from TcServer and stored in CDM.
 *
 * Called only by invoker.
 *
 * @module js/invoker/propertyLoader
 */

import _ from 'lodash';
import cdm from 'soa/kernel/clientDataModel';
import dateTimeSvc from 'js/dateTimeService';
import declUtils from 'js/declUtils';
import uwPropertySvc from 'js/uwPropertyService';
import viewModelObjectService from 'js/viewModelObjectService';

/**
 * This is added to handle relational property specified in objectset. prop specified as "relName.relProp", need to
 * extract the actual prop name to extract value from the refModel Object
 * Shamelessly copied from CfX as it isn't exported from there.
 *
 * @param {Object} prop - The IViewModelPropObject of an IViewModelObject (from serverVMO or modelObject property)
 * @param {String} propName - The property name
 * @param {IModelObject} refModelObject - The actual IModelObject for which we are creating ViewModelObject
 *
 * @return {ModelObjectProperty|null} The Result.
 */
var _getSourceObjectProp = function( prop, propName, refModelObject ) {
    var srcObj = null;

    var sourceObjectUid = uwPropertySvc.getSourceObjectUid( prop );
    if( !_.isUndefined( sourceObjectUid ) && !_.isEmpty( sourceObjectUid ) ) {
        srcObj = cdm.getObject( sourceObjectUid );
    } else {
        srcObj = refModelObject;
    }

    var srcObjProp = srcObj ? srcObj.props[ propName ] : null;

    if( !srcObjProp && /\./.test( propName ) ) {
        var actualPropName = uwPropertySvc.getBasePropertyName( propName );

        srcObjProp = srcObj ? srcObj.props[ actualPropName ] : null;
    }

    return srcObjProp;
};

/**
 * format serverVMO/modelObject property as par consistent API schema.
 * Shamelessly copied from CfX as it isn't exported from there.
 * Optimized a little
 *
 * @constructor
 *
 * @param {propObject} prop - The IModelObject to create a ViewModelObject for.
 * @param {string} propName - The IModelObject to create a ViewModelObject for.
 * @param {serverVMO} modelObject - The IModelObject to create a ViewModelObject for.
 */
var _formatProperties = function( prop, propName, modelObject ) {
    var propValue = prop instanceof Object ? Object.assign( {}, prop ) : new Object();
    var initialValue = '';
    var inputDbValues = null;
    var displayValues = null;
    var propDesc = prop.propertyDescriptor;
    propValue.isModifiable = false;
    if( !declUtils.isNil( prop.hasLOV ) ) {
        propValue.hasLOV = prop.hasLOV;
    } else {
        propValue.hasLOV = propDesc && propDesc.lovCategory > 0;
    }
    //
    // Deleted block related to serverVMO. No serverVMOs in this use case
    //
    {
        var constantsMap;
        if( propDesc ) {
            propValue.isArray = propDesc.anArray;
            propValue.propType = viewModelObjectService.getClientPropertyType( propDesc.valueType, propValue.isArray );
            propValue.isCharArray = propDesc.valueType === 1;
            propValue.displayName = propDesc.displayName;
            propValue.maxLength = propDesc.maxLength;
            propValue.maxArraySize = propDesc.maxArraySize ? propDesc.maxArraySize : -1;
            constantsMap = propDesc.constantsMap;
        }
        if( constantsMap ) {
            initialValue = constantsMap.initialValue;
            propValue.initialValue = constantsMap.initialValue;
            propValue.isEditable = constantsMap.editable === '1';
            propValue.isRequired = constantsMap.required === '1';
            propValue.isAutoAssignable = constantsMap.autoassignable === '1';
            propValue.isRichText = constantsMap.Fnd0RichText === '1';
            propValue.isEnabled = constantsMap.editable ? constantsMap.editable === '1' : true;
            propValue.referenceTypeName = constantsMap.ReferencedTypeName || '';
            if( propValue.propType === 'DATE' || propValue.propType === 'DATEARRAY' ) {
                //from SOA getTypeDescriptions2, timeEnabled is undefined when Fnd0EnableTimeForDateProperty is default false.
                propValue.isTimeEnabled = _.isUndefined( constantsMap.timeEnabled ) ? false : constantsMap.timeEnabled === '1';
            }
            // If isModifiable is false on the modelObject, use that first over propertyDescriptor's constantsMap default value
            if( modelObject && modelObject.props &&
                modelObject.props.is_modifiable &&
                modelObject.props.is_modifiable.dbValues &&
                modelObject.props.is_modifiable.dbValues[ 0 ] === '0' ) {
                propValue.isModifiable = false;
            } else {
                propValue.isModifiable = constantsMap.modifiable === '1';
            }
        }
    }
    if( _.isNil( propValue.isModifiable ) ) {
        propValue.isModifiable = false;
    }
    //
    // Deleted block of special cases regarding operationName (setting isEditable)
    //
    if( propValue.isDCP ) {
        inputDbValues = prop && prop.dbValues || [];
        displayValues = prop && prop.uiValues || [];
        // Check if user has READ Access. If YES (hasReadAccess is undefined in this case) then format the Date.
        if( ( propValue.propType === 'DATE' || propValue.propType === 'DATEARRAY' ) && prop.hasReadAccess === undefined ) {
            //For DCP property, replace displayValues with the date formatted dbValues value
            var tempDisplayValues = [];
            for( var indx = 0; indx < inputDbValues.length; indx++ ) {
                if( propValue.isTimeEnabled === false ) {
                    tempDisplayValues.push( dateTimeSvc.formatSessionDate( inputDbValues[ indx ] ) );
                } else {
                    tempDisplayValues.push( dateTimeSvc.formatSessionDateTime( inputDbValues[ indx ] ) );
                }
            }
            if( tempDisplayValues.length > 0 ) {
                displayValues = tempDisplayValues;
            }
        }
    } else {
        var srcObjProp = _getSourceObjectProp( prop, propName, modelObject );
        inputDbValues = srcObjProp && srcObjProp.dbValues || [];
        displayValues = srcObjProp && srcObjProp.uiValues || [];
    }
    propValue.dbValues = inputDbValues;
    if( inputDbValues && inputDbValues.length > 0 ) {
        propValue.value = inputDbValues;
    } else if( initialValue !== '' ) {
        propValue.value = initialValue;
    } else {
        propValue.value = null;
    }
    propValue.displayValue = displayValues;
    return propValue;
};

let updateTreeNodePropertiesFromCDM = function( viewModelTreeNodes ) {
    //var index = 0;
    for ( let vmtn of viewModelTreeNodes ) {
        if ( vmtn !== null ) {
            vmtn.isDeleted = false;
            vmtn.isGreyedOutElement = vmtn.isGreyedOutElement === true;
            let modelObject = cdm.getObject( vmtn.uid );
            if ( modelObject !== null && vmtn.props === undefined ) {
                vmtn.props = {};
            }
            //console.log( 'VMTN[' + index++ + '] ' + vmtn.displayName + ' props updated' );
            for ( const [ propName, propValue ] of Object.entries(  modelObject?.props || {} ) ) {
            //_.forEach( modelObject.props, function( propValue, propName ) {
                if( propValue ) {
                    //console.log( 'setting ' + node.uid + ' prop ' + propName + ' = ' + propValue.dbValues + propValue.uiValues );
                    // viewModelObjectService.constructViewModelProperty requires a prop object with 'displayValue' attribute so
                    // call this intermediate function copied from CfX to produce it. This seems to be be required in order to
                    // jump directly from MO to VMTN.
                    let intermediateProp = _formatProperties( propValue, propName, modelObject );
                    let isDateAdjusted = true;
                    vmtn.props[ propName ] = viewModelObjectService.constructViewModelProperty( intermediateProp, propName, vmtn, isDateAdjusted );
                }
            }
            delete vmtn.isPropLoading;
            // Reset edit state since props have loaded
            viewModelObjectService.setEditState( vmtn, false );
        }
    }
};

let exports = {
    updateTreeNodePropertiesFromCDM
};
export default exports;
