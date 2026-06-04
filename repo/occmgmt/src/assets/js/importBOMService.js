
// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Module for the Import BOM panel
 *
 * @module js/importBOMService
 */

import msgSvc from 'js/messagingService';
import uwPropertyService from 'js/uwPropertyService';
import appCtxSvc from 'js/appCtxService';
import notyService from 'js/NotyModule';
import eventBus from 'js/eventBus';
import importPreviewSetActionOnLine from 'js/importPreviewSetActionOnLine';
import localeService from 'js/localeService';
import _ from 'lodash';
import 'js/listBoxService';
import browserUtils from 'js/browserUtils';
import AwHttpService from 'js/awHttpService';
import AwPromiseService from 'js/awPromiseService';
import _localeSvc from 'js/localeService';
import dialogService from 'js/dialogService';
import soaSvc from 'soa/kernel/soaService';
import AwStateService from 'js/awStateService';

let exports = {};
let localeTextBundle = localeService.getLoadedText( 'OccmgmtImportExportConstants' );
let ADD_NEW_INTERNAL = 'add_new';
// RT file types to set default update scope options
let RT_STRUCTURE = 'XLS_Structure';
let RT_RELATIONS = 'XLS_Relations';
let RT_PARTS = 'XLS_Parts';

/**
 * It disables Import Structure button in panel when import operation is in progress.
 */
export let registerExcelData = function() {
    appCtxSvc.registerCtx( 'awb0ImportFromExcelProgressing', true );
};

/**
 * This API reset awb0ImportFromExcelProgressing flag in context to make
 * sure Import Structure button gets enabled whenever import operation fails.
 */
export let enableImportStructureButtonInPanel = function() {
    appCtxSvc.updateCtx( 'awb0ImportFromExcelProgressing', false );
};

/**
 * Unregister the flags from view model data for excel import
 */
export let unRegisterExcelData = function() {
    appCtxSvc.updateCtx( 'awb0ImportFromExcelProgressing', false );
    if( appCtxSvc.getCtx( 'isAwb0ImportFromExcelSubPanelActive' ) ) {
        appCtxSvc.unRegisterCtx( 'isAwb0ImportFromExcelSubPanelActive' );
    }
};

/**
 * Updates view model according to file selected
 * @param {Object} fileName - Name of selected file
 *
 */
export let updateFormData = function( fileName, fileNameNoExt, validFile, formData ) {
    if( validFile ) {
        if( fileName && fileName !== '' ) {
            // In Preview mode, on choosing a different input file, unregister preview context
            let importBOMContext = appCtxSvc.getCtx( 'ImportBOMContext' );
            if( importBOMContext !== undefined ) {
                // If the import was initiated from change content, we need to retain this knowledge
                // so we know to navigate back to the change content when the import completes
                let backupisChangeContentImport = importBOMContext.isChangeContentImport ? importBOMContext.isChangeContentImport : false;
                let backupChangeContentUID = importBOMContext.changeContentUID ? importBOMContext.changeContentUID : undefined;
                appCtxSvc.unRegisterCtx( 'ImportBOMContext' );
                appCtxSvc.registerCtx( 'ImportBOMContext', {
                    isChangeContentImport: backupisChangeContentImport,
                    changeContentUID: backupChangeContentUID
                } );
            }
            unRegisterExcelData();
            if( !appCtxSvc.getCtx( 'isAwb0ImportFromExcelSubPanelActive' ) ) {
                appCtxSvc.registerCtx( 'isAwb0ImportFromExcelSubPanelActive', true );
            }
            eventBus.publish( 'importBOM.startPostFileUploadProcess' );
        }
    } else if( fileName ) {
        let resource = 'OccmgmtImportExportConstants';
        let localTextBundle = localeService.getLoadedText( resource );
        let localizedMsg = localTextBundle.invalidFileExtension;
        msgSvc.showError( localizedMsg );
    }

    return {
        fileName,
        fileNameNoExt,
        validFile,
        formData
    };
};

/**
 * Reset Data from import from excel panel.
 *
 * @param {Object} data - The view model data
 *
 */
export let resetExcelImportData = function( mappingGroup, sharedData = {} ) {
    let mappingGroupCopy = { ...mappingGroup };
    mappingGroupCopy.dbValue = '';
    mappingGroupCopy.uiValue = '';
    mappingGroupCopy.dbValues = '';
    mappingGroupCopy.uiValues = '';
    mappingGroupCopy.dbOriginalValue = '';
    mappingGroupCopy.uiOriginalValue = '';
    // Save the dbValue and uiValue of the previously used mappingGroup for use
    // when retrying an import after failure.
    if ( mappingGroup.dbValue && mappingGroup.dbValue !== '' ) {
        mappingGroupCopy.prevDbValue = mappingGroup.dbValue;
    }
    if ( mappingGroup.uiValue && mappingGroup.uiValue !== '' ) {
        mappingGroupCopy.prevUiValue = mappingGroup.uiValue;
    }
    const newSharedData = { ...sharedData.value };
    newSharedData.typePropInfos = [];
    sharedData.update && sharedData.update( newSharedData );
    return {
        showPropertiesMap: false,
        isAwb0ImportButtonIsVisible: false,
        isMultiSheetImport : false,
        columnHeaders: [],
        secTypePropInfos: [],
        objectSubTypes: [],
        viewModelPropertiesForHeader: [],
        requiredColumnHeadersForAllSheets:[],
        mappingGroup: mappingGroupCopy
    };
};

/**
 * This API appends " (Required)" into display name if property is a required.
 * @param {*} propInfo - property info
 * @param {*} objectTypeInfo - Type of object (part,item etc)
 * @param {*} requiredString - i18n string for required properties
 * @param {Boolean} secMultiType - this indicates secondary prop infos being processed and
 *                  there are multiple types which require special processing when
 *                  creating labels for secondary properties
 * @returns {String} - property display name
 */
let appendRequiredStringForRequiredProperty = function( propInfo, objectTypeInfo, requiredString, secMultiType ) {
    if( propInfo.isRequired ) {
        if( propInfo.isSecondaryObject ) {
            // special processing for secondary objects
            if( secMultiType ) {
                // multiple types, use generic label that will be applied to all types properties
                let propName = propInfo.dispPropName;
                if( objectTypeInfo.propInternalValue === 'ManufacturerPart'
                    && propInfo.realPropName === 'object_name' ) {
                    propName = localeTextBundle.defaultName;
                }
                return localeTextBundle.secondaryPropTitle + ' : ' + propName + requiredString;
            }

            // only one type, ok to use object type in label, this maintians old behavior
            return objectTypeInfo.propDisplayValue + ':' + propInfo.dispPropName + requiredString;
        }
        return propInfo.dispPropName + requiredString;
    }
    return propInfo.dispPropName;
};

/**
 * Create view model property for the property info
 * @param {Object} objectTypeInfo - Type of object (part,item etc)
 * @param {Object} propInfo - Property info
 * @param {Boolean} secMultiType - this indicates we are processing secondary prop infos and
 *        have multiple types which require special processing when creating labels for propInfo
 * @returns {Object} viewModelObject - view model object for the given property info
 */
let createViewModelObjectForProperty = function( objectTypeInfo, propInfo, secMultiType ) {
    let dispPropName = appendRequiredStringForRequiredProperty( propInfo, objectTypeInfo, localeTextBundle.required, secMultiType );
    let viewProp = uwPropertyService.createViewModelProperty( objectTypeInfo.propInternalValue + '.' + propInfo.realPropName, dispPropName, 'BOOLEAN', [], [] );
    viewProp.isSecondaryObject = false;
    if( propInfo.isSecondaryObject ) {
        viewProp.isSecondaryObject = propInfo.isSecondaryObject;
    }
    uwPropertyService.setIsRequired( viewProp, propInfo.isRequired );
    uwPropertyService.setIsArray( viewProp, false );
    uwPropertyService.setIsEditable( viewProp, true );
    uwPropertyService.setIsNull( viewProp, false );
    uwPropertyService.setPropertyLabelDisplay( viewProp, 'PROPERTY_LABEL_AT_RIGHT' );
    if( viewProp.isRequired ) {
        uwPropertyService.setValue( viewProp, true );
        uwPropertyService.setIsEnabled( viewProp, false );
    } else {
        uwPropertyService.setValue( viewProp, false );
        uwPropertyService.setIsEnabled( viewProp, true );
    }
    // attributes required to show property in lov
    viewProp.propDisplayValue = viewProp.propertyDisplayName;
    viewProp.propInternalValue = viewProp.propertyName;
    return viewProp;
};

/**
 * API created the Right side labels of our panel
 * @param {*} typePropInfos - this is either a list of primary or secondary prop infos
 * @param {Boolean} secMultiType - this indicates secondary prop infos being processed and
 *                  there are multiple types which require special processing when
 *                  creating labels for secondary properties
 * @returns {String} objectSubTypes - list of object types that had labels created for there properties
 */
let createPropertyLabelsOnTheRight = function( typePropInfos, secMultiType ) {
    let objectSubTypes = [];
    for( let index = 0; index < typePropInfos.length; index++ ) {
        let typePropInfo = typePropInfos[ index ];
        let objectType = {
            propDisplayValue: typePropInfo.dispTypeName,
            propInternalValue: typePropInfo.objectType
        };
        objectSubTypes.push( objectType );
        let propInfos = typePropInfo.propInfos;
        for( let propInfoIdx = 0; propInfoIdx < propInfos.length; propInfoIdx++ ) {
            propInfos[ propInfoIdx ] = createViewModelObjectForProperty( objectType, propInfos[ propInfoIdx ], secMultiType );
        }
        _sortBooleanList( propInfos );
    }
    return objectSubTypes;
};

/**
 * If index is 0 then prop Info is a primary object and if it is 1 then it is secondary object
 * @param {*} propInfo property info
 * @param {*} typeInfo type Info object
 * @param {*} index index of response array
 */
let setObjectTypeOnObject = function( propInfo, typeInfo, index ) {
    if( index === 1 ) {
        if( propInfo ) {
            propInfo.isSecondaryObject = true;
        }
        if( typeInfo ) {
            _.forEach( typeInfo.propInfos, function( propInfo ) {
                propInfo.isSecondaryObject = true;
            } );
        }
    } else {
        if( propInfo ) {
            propInfo.isSecondaryObject = false;
        }
        if( typeInfo ) {
            _.forEach( typeInfo.propInfos, function( propInfo ) {
                propInfo.isSecondaryObject = false;
            } );
        }
    }
};

/**
 * Create view model property for the header
 *
 * @param {Object} header - Header string
 * @returns {Object} viewModelObject - view model object for the given header
 */
let createViewModelPropertyForHeader = function( header ) {
    // Create the viewModel property for the given attribute type.
    let viewProp = uwPropertyService.createViewModelProperty( header, header, 'STRING', [], [] );
    viewProp.editLayoutSide = true;
    uwPropertyService.setHasLov( viewProp, true );
    uwPropertyService.setIsArray( viewProp, false );
    uwPropertyService.setIsEnabled( viewProp, true );
    uwPropertyService.setIsEditable( viewProp, true );
    uwPropertyService.setIsNull( viewProp, false );
    uwPropertyService.setPropertyLabelDisplay( viewProp, 'PROPERTY_LABEL_AT_SIDE' );
    viewProp.dataProvider = 'LOVDataProvider';
    return viewProp;
};

/**
 * Populates following on data from server response.
 * 1) Type prop info
 * 2) Column Headers
 * 3) Secondary column headers
 * 4) Secondary type prop Info
 * @param {*} data data received from server
 */
let populatePropInfoAndTypeInfoMap = function( data ) {
    let VMPropForHeader = [];
    let columnHeaders = [];
    let typePropInfos = [];
    let secTypePropInfos = [];
    let requiredColumnHeadersForAllSheets = [];
    for( let index = 0; index < data.mappingGroupResponse.mappingOutputs.length; index++ ) {
        let mappingOutput = data.mappingGroupResponse.mappingOutputs[ index ];
        _.forEach( mappingOutput.propInfos, function( propInfo ) {
            setObjectTypeOnObject( propInfo, undefined, index );
            let viewProp = createViewModelPropertyForHeader( propInfo.propHeader );
            viewProp.isSecondaryObject = false;
            if( propInfo.isSecondaryObject ) {
                viewProp.isSecondaryObject = propInfo.isSecondaryObject;
            }
            VMPropForHeader.push( viewProp );
            columnHeaders.push( propInfo.propHeader );
        } );
        _.forEach( mappingOutput.typePropInfos, function( typePropInfo ) {
            setObjectTypeOnObject( undefined, typePropInfo, index );
            if( index === 1 ) {
                secTypePropInfos.push( typePropInfo );
            } else {
                typePropInfos.push( typePropInfo );
            }
        } );

        let sheetInfos = mappingOutput.sheetInfos;
        if( sheetInfos && sheetInfos.length > 0 ) {
        // Iterate over each sheet's info to update headers and object types in the requiredColumnHeadersForAllSheets array
            sheetInfos.forEach( sheetInfo => {
                let isSecondaryObjectFound = false;
                const { sheetIndex, propInfos, typePropInfos } = sheetInfo;

                if ( !requiredColumnHeadersForAllSheets[sheetIndex] ) {
                    requiredColumnHeadersForAllSheets[sheetIndex] = {
                        headers: [],
                        isSecondaryObjectPresent: false,
                        objectTypes: []
                    };
                }

                let currentSheetProps = requiredColumnHeadersForAllSheets[sheetIndex];

                // Add unique headers from propInfos
                propInfos.forEach( propInfo => {
                    if ( !currentSheetProps.headers.includes( propInfo.propHeader ) ) {
                        currentSheetProps.headers.push( propInfo.propHeader );
                    }
                    if ( propInfo.isSecondaryObject ) {
                        isSecondaryObjectFound = true;
                    }
                } );

                // Add unique objectTypes from typePropInfos
                typePropInfos.forEach( typePropInfo => {
                    if ( !currentSheetProps.objectTypes.includes( typePropInfo.objectType ) ) {
                        currentSheetProps.objectTypes.push( typePropInfo.objectType );
                    }
                    if( index === 1 ) {
                        isSecondaryObjectFound = true;
                    }
                } );
                if( isSecondaryObjectFound ) {
                    currentSheetProps.isSecondaryObjectPresent = isSecondaryObjectFound;
                }
            } );
        }
    }
    return {
        VMPropForHeader,
        columnHeaders,
        typePropInfos,
        secTypePropInfos,
        requiredColumnHeadersForAllSheets
    };
};

/**
 * Using the update scope checkbox values, get the corresponding update scope option strings
 *
 * @param {Boolean} structureScopeOption - The dbValue of the Update Structure Scope checkbox.
 * @param {Boolean} relationsScopeOption - The dbValue of the Update Relations Scope checkbox.
 * @param {Boolean} partsScopeOption - The dbValue of the Update Items Scope checkbox.
 * @returns {Array} scope - Array of update scope strings
 */
let evaluateScopeSelection = function( structureScopeOption, relationsScopeOption, partsScopeOption ) {
    let scope = [];

    if ( structureScopeOption ) {
        scope.push( RT_STRUCTURE );
    }
    if ( relationsScopeOption ) {
        scope.push( RT_RELATIONS );
    }
    if ( partsScopeOption ) {
        scope.push( RT_PARTS );
    }

    return scope;
};

/**
 * Update Properties with selected properties
 * @param {Object} data - The view model data
 */
export let updatePropertiesForMapping = function( typePropInfos, secTypePropInfos ) {
    let propertiesForMapping = [];
    // Get selected properties
    for( let typePropInfoIndex = 0; typePropInfoIndex < typePropInfos.length; typePropInfoIndex++ ) {
        let typePropInfo = typePropInfos[ typePropInfoIndex ];
        let propInfos = typePropInfo.propInfos;
        for( let propInfoIndex = 0; propInfoIndex < propInfos.length; propInfoIndex++ ) {
            let propInfo = propInfos[ propInfoIndex ];
            // Add required/selected properties to the list
            if( propInfo.dbValue ) {
                propertiesForMapping.push( propInfo );
            }
        }
    }
    if( secTypePropInfos ) {
        for( let typePropInfoIndex = 0; typePropInfoIndex < secTypePropInfos.length; typePropInfoIndex++ ) {
            let typePropInfo = secTypePropInfos[ typePropInfoIndex ];
            let propInfos = typePropInfo.propInfos;
            for( let propInfoIndex = 0; propInfoIndex < propInfos.length; propInfoIndex++ ) {
                let propInfo = propInfos[ propInfoIndex ];
                // Add required/selected properties to the list
                if( propInfo.dbValue ) {
                    propertiesForMapping.push( propInfo );
                }
            }
        }
    }
    return propertiesForMapping;
};

/**
 * API process server response and populates all the maps it required for validation and processing od request
 * Get headers and properties from response data.
 * Automatically maps required properties if the column name matches the property name.
 *
 * @param {Object} data - The view model data
 */
export let createPropertiesMap = function( data, sharedData = {} ) {
    let showPropertiesMap = true;
    let isMultiSheetImport = data.mappingGroupResponse.mappingOutputs[0]?.sheetInfos?.length > 1;
    let { VMPropForHeader, columnHeaders, typePropInfos, secTypePropInfos, requiredColumnHeadersForAllSheets } = populatePropInfoAndTypeInfoMap( data );
    // Create view model properties for properties
    // no special processing of primary labels required
    let objectSubTypes = createPropertyLabelsOnTheRight( typePropInfos, false );
    // need special processing of secondary labels if secTypePropInfos is greater than one object type
    let secObjectSubTypes = createPropertyLabelsOnTheRight( secTypePropInfos, secTypePropInfos.length > 1 );
    const newSharedData = { ...sharedData.value };
    newSharedData.typePropInfos = typePropInfos;
    newSharedData.secTypePropInfos = secTypePropInfos;
    sharedData.update && sharedData.update( newSharedData );

    let propertiesForMapping = exports.updatePropertiesForMapping( typePropInfos, secTypePropInfos );

    // Automatically maps required properties if the column name matches the property name.
    let requiredProperties = [];
    propertiesForMapping.forEach( vmProp => {
        getRequiredProperties( requiredProperties, vmProp );
    } );

    // Iterate over required properties and update corresponding VM properties
    requiredProperties.forEach( requiredProp => {
        const extractedValue = requiredProp.propDisplayValue.split( ' (' )[0];

        VMPropForHeader.forEach( vmProp => {
            if ( vmProp.propertyName === extractedValue ) {
                vmProp.dbValue = requiredProp.propInternalValue;
                vmProp.uiValue = requiredProp.propDisplayValue;
            }
        } );
    } );

    return {
        showPropertiesMap,
        VMPropForHeader,
        columnHeaders,
        typePropInfos,
        secTypePropInfos,
        objectSubTypes,
        secObjectSubTypes,
        propertiesForMapping,
        requiredColumnHeadersForAllSheets,
        isMultiSheetImport
    };
};


/**
 * Get the property to the list if it doesn't already exist and is required.
 *
 * @param {Array} lovEntries - The list of properties to check and update.
 * @param {Object} vmProp - The property object to be added if necessary.
 */
let getRequiredProperties = ( lovEntries, vmProp ) => {
    let propertyExists = _checkIfLOVEntryAlreadyExists( lovEntries, vmProp );

    // Add property to the list if it does not exist and is required
    let isSecondaryObjectValue = vmProp.isSecondaryObject ? vmProp.isSecondaryObject : false;
    if ( !propertyExists && vmProp.isRequired ) {
        lovEntries.push( {
            propDisplayValue: vmProp.propertyDisplayName,
            propInternalValue: vmProp.propertyName,
            isRequired: vmProp.isRequired,
            isSecondaryObject: isSecondaryObjectValue
        } );
    }
};


/**
 * Every time we load new mapping, we need to destroy existing header view model properties and recreate them
 * to make sure UI works consistently.
 * @param {Object} data - Declarative View Model Object
 * @returns {Object} - VMOs for excel header mapper with empty values (reset)
 */
let destroyExistingVMOAndReCreateVMOForHeaders = function( data ) {
    let newViewModelPropertiesForHeader = [];
    for( let index = 0; index < data.columnHeaders.length; index++ ) {
        let header = data.columnHeaders[ index ];
        let viewProp = createViewModelPropertyForHeader( header );
        viewProp.isSecondaryObject = data.viewModelPropertiesForHeader[ index ].isSecondaryObject;
        newViewModelPropertiesForHeader.push( viewProp );
    }
    return newViewModelPropertiesForHeader;
};

/**
 * API reads server response and populates all the saved mapping values in LOV view model properties.
 * @param {Object} propsFromServer - saved mapping's mapped properties
 * @param {Object} newViewModelPropertiesForHeader - VMOs for excel header mapper
 *
 */
let populateValueInLOVFromServerResponse = function( propsFromServer, newViewModelPropertiesForHeader ) {
    for( let headerVMOIndex = 0; headerVMOIndex < newViewModelPropertiesForHeader.length; headerVMOIndex++ ) {
        let headerViewModelProp = newViewModelPropertiesForHeader[ headerVMOIndex ];
        for( let propInfoIndex = 0; propInfoIndex < propsFromServer.length; propInfoIndex++ ) {
            let propInfoFromResp = propsFromServer[ propInfoIndex ];
            if( headerViewModelProp.propertyName === propInfoFromResp.propHeader ) {
                headerViewModelProp.dbValue = propInfoFromResp.realPropName;
                headerViewModelProp.uiValue = propInfoFromResp.dispPropName;
                break;
            }
        }
    }
};

/**
 * API iterates over all the header view model properties and set modifiablity flag as per server response.
 * @param {*} selectedMappingGroup - mapping selected from Saved Mappings list
 * @param {*} newViewModelPropertiesForHeader - VMOs for excel header mapper
 */
let setModifiabilityOnHeaderVMProp = function( selectedMappingGroup, newViewModelPropertiesForHeader ) {
    for( let indexOfHeaderVMP = 0; indexOfHeaderVMP < newViewModelPropertiesForHeader.length; indexOfHeaderVMP++ ) {
        newViewModelPropertiesForHeader[ indexOfHeaderVMP ].isEnabled = selectedMappingGroup.isModifiable;
    }
};

/**
 * This API takes value from server property info and populates them in corresponding header property info. If populated property is required then we add
 * (Required) string in its label.
 *
 * @param {*} propInfoFromTypeInfoMap : This prop info comes from type Prop info list. It has all the meta data of all the properties of loaded business objects
 * @param {*} newViewModelPropertiesForHeader : VMOs for excel header mapper
 * @param {*} propInfoFromServer propInfo coming from server which could have value which needs to be populated in header view model property
 */
let updateValuesInHeaderVMOAsPerValuesComingFromServer = function( propInfoFromTypeInfoMap, newViewModelPropertiesForHeader, propInfoFromServer ) {
    if( propInfoFromTypeInfoMap.isRequired ) {
        for( let headerVMPropIndex = 0; headerVMPropIndex < newViewModelPropertiesForHeader.length; headerVMPropIndex++ ) {
            let headerVMProp = newViewModelPropertiesForHeader[ headerVMPropIndex ];
            if( headerVMProp.uiValue === propInfoFromServer.dispPropName ) {
                // Add required/selected properties to the list
                headerVMProp.uiValue += localeTextBundle.required;
            }
        }
    }
};

/**
 * API checks whether incoming property already exist in propertiesForMapping map or not. If it exists then we do not add it otherwise we
 * add it in properties for mapping array.
 * @param {*} propertiesForMapping Current properties to be mapped list
 * @param {*} propInfoFromTypeInfoMap propInfo which need to be added it already not available in propertiesForMapping map.
 */
let updateDataPropertyMapping = function( propertiesForMapping, propInfoFromTypeInfoMap ) {
    let isPropExist = false;
    for( let index = 0; index < propertiesForMapping.length; index++ ) {
        let existingProperty = propertiesForMapping[ index ];
        if( _.isEqual( existingProperty.propertyName, propInfoFromTypeInfoMap.propertyName ) ) {
            isPropExist = true;
            break;
        }
    }
    if( !isPropExist ) {
        propertiesForMapping.push( propInfoFromTypeInfoMap );
    }
};

/**
 * API searches for all required properties and adds Required String in their ui value.
 * @param {Object} data - The view model data
 * @param {Object} newViewModelPropertiesForHeader - VMOs for excel header mappers
 * @returns {Object} - Object with updated values for typePropInfos and propertiesForMapping
 */
let processUIValuesOfAllReqPropsInLOV = function( data, newViewModelPropertiesForHeader ) {
    let typePropInfos = _.clone( data.subPanelContext.sharedData.typePropInfos );
    let secTypePropInfos = _.clone( data.subPanelContext.sharedData.secTypePropInfos );
    let propertiesForMapping = _.clone( data.propertiesForMapping );
    for( let mappingOutputIndex = 0; mappingOutputIndex < data.selectedMapping.mappingOutputs.length; mappingOutputIndex++ ) {
        let mappingOutput = data.selectedMapping.mappingOutputs[ mappingOutputIndex ];
        for( let propInfoIndexForMappingOut = 0; propInfoIndexForMappingOut < mappingOutput.propInfos.length; propInfoIndexForMappingOut++ ) {
            let propInfoFromServer = mappingOutput.propInfos[ propInfoIndexForMappingOut ];
            for( let typePropInfoIndex = 0; typePropInfoIndex < typePropInfos.length; typePropInfoIndex++ ) {
                let typePropInfo = typePropInfos[ typePropInfoIndex ];
                let propInfos = typePropInfo.propInfos;
                for( let propInfoIndex = 0; propInfoIndex < propInfos.length; propInfoIndex++ ) {
                    let propInfoFromTypeInfoMap = propInfos[ propInfoIndex ];
                    if( propInfoFromServer.realPropName === propInfoFromTypeInfoMap.propInternalValue ) {
                        propInfoFromTypeInfoMap.dbValue = true;
                        updateDataPropertyMapping( propertiesForMapping, propInfoFromTypeInfoMap );
                        updateValuesInHeaderVMOAsPerValuesComingFromServer( propInfoFromTypeInfoMap, newViewModelPropertiesForHeader, propInfoFromServer );
                        break;
                    }
                }
            }
            if ( secTypePropInfos && secTypePropInfos.length > 0 ) {
                for( let secTypePropInfoIndex = 0; secTypePropInfoIndex < secTypePropInfos.length; secTypePropInfoIndex++ ) {
                    let secTypePropInfo = secTypePropInfos[ secTypePropInfoIndex ];
                    let propInfos = secTypePropInfo.propInfos;
                    for( let propInfoIndex = 0; propInfoIndex < propInfos.length; propInfoIndex++ ) {
                        let propInfoFromTypeInfoMap = propInfos[ propInfoIndex ];
                        if( propInfoFromServer.realPropName === propInfoFromTypeInfoMap.propInternalValue ) {
                            propInfoFromTypeInfoMap.dbValue = true;
                            updateDataPropertyMapping( propertiesForMapping, propInfoFromTypeInfoMap );
                            updateValuesInHeaderVMOAsPerValuesComingFromServer( propInfoFromTypeInfoMap, newViewModelPropertiesForHeader, propInfoFromServer );
                            break;
                        }
                    }
                }
            }
        }
    }
    return {
        typePropInfos: typePropInfos,
        secTypePropInfos: secTypePropInfos,
        propertiesForMapping: propertiesForMapping
    };
};

/**
 * Get Mappings for the group selected
 *
 * @param {Object} data - The view model data
 *
 */
export let populateMappingInfoForGroup = function( data ) {
    if( data.mappingGroupResponse.mappingOutputs.length > 0 && data.mappingGroupResponse.mappingOutputs[ 0 ].mappingGroups.length > 0 ) {
        if( data.mappingGroup.dbValue === data.selectedMapping.mappingOutputs[ 0 ].mappingGroups[ 0 ].dispName ) {
            let newViewModelPropertiesForHeader = destroyExistingVMOAndReCreateVMOForHeaders( data );
            populateValueInLOVFromServerResponse( data.selectedMapping.mappingOutputs[0].propInfos, newViewModelPropertiesForHeader );
            let { typePropInfos, secTypePropInfos, propertiesForMapping } = processUIValuesOfAllReqPropsInLOV( data, newViewModelPropertiesForHeader );
            setModifiabilityOnHeaderVMProp( data.selectedMapping.mappingOutputs[ 0 ].mappingGroups[ 0 ], newViewModelPropertiesForHeader );
            const newSharedData = { ...data.subPanelContext.sharedData.value };
            newSharedData.typePropInfos = typePropInfos;
            newSharedData.secTypePropInfos = secTypePropInfos;
            data.subPanelContext.sharedData.update && data.subPanelContext.sharedData.update( newSharedData );
            let allRequiredPropMapped = doesCurrentMappingHaveAllReqProps( data.propertiesForMapping, data.requiredColumnHeadersForAllSheets, newViewModelPropertiesForHeader );
            return{
                viewModelPropertiesForHeader: newViewModelPropertiesForHeader,
                propertiesForMapping: propertiesForMapping,
                isAwb0ImportButtonIsVisible: allRequiredPropMapped
            };
        }
    }
};

/**
 * Get all objects types that use the header properties in viewProp.
 * Search specific typePropInfos Property mappings for viewProp.
 *
 * @param {Object} typePropInfos - Types with their mappable property information
 * @param {Object} viewProp - The view header properties mapping
 *
 */
let getTypesFromTypePropInfos = function( typePropInfos, viewProp ) {
    let objectTypes = [];
    let propInternalName = viewProp.dbValue.split( '.' )[ 1 ];
    if( propInternalName ) {
        for( let infoIndex = 0; infoIndex < typePropInfos.length; infoIndex++ ) {
            let typePropInfo = typePropInfos[infoIndex];
            let objectType = typePropInfo.objectType;
            let propInfos = typePropInfo.propInfos;
            for( let propIndex = 0; propIndex < propInfos.length; propIndex++ ) {
                let propInfo = propInfos[propIndex];
                let propInfoPropInternalName = propInfo.propertyName.split( '.' )[ 1 ];
                // Add object type only if internal names are identical and if typePropInfo and viewProp both correspond to primary or secondary objects
                if( propInternalName === propInfoPropInternalName && propInfo.isSecondaryObject === viewProp.isSecondaryObject ) {
                    objectTypes.push( objectType );
                    break;
                }
            }
        }
    }
    return objectTypes;
};

/**
 * Get all objects types that use the header property in viewProp.
 * Search data for both primary and secondary type Property mappings for viewProp.
 *
 * @param {Object} data - The view model data
 * @param {Object} viewProp - The view header properties mapping
 *
 */
let getTypesFromData = function( data, viewProp ) {
    let objectTypes = [];
    let primaryObjectTypes = getTypesFromTypePropInfos( data.typePropInfos, viewProp );
    for( let primIndex = 0; primIndex < primaryObjectTypes.length; primIndex++ ) {
        objectTypes.push( primaryObjectTypes[primIndex] );
    }
    let secondaryObjectTypes = getTypesFromTypePropInfos( data.secTypePropInfos, viewProp );
    for( let secIndex = 0; secIndex < secondaryObjectTypes.length; secIndex++ ) {
        objectTypes.push( secondaryObjectTypes[secIndex] );
    }
    return objectTypes;
};

/**
 * Get an array of propInfos for each type in the sheet
 * as well as an array of mappable properties
 *
 * @param {Object} data - The view model data
 *
 */
let getTypeMapInfos = function( data ) {
    let typeMapInfos = {};
    let mappingInfo = [];
    let typeSheetMapInfo = {};
    for( let index = 0; index < data.viewModelPropertiesForHeader.length; index++ ) {
        let viewProp = data.viewModelPropertiesForHeader[ index ];
        if( viewProp.dbValue && !_.isArray( viewProp.dbValue ) ) {
            let dispProp = viewProp.uiValue.replace( data.i18n.required, '' );
            let dbValue = viewProp.dbValue.split( '.' );
            let propertyName = viewProp.dbValue;
            let type = '';
            if( dbValue.length === 2 ) {
                propertyName = dbValue[ 1 ];
                type = dbValue[ 0 ];
            }
            let prop = {
                propHeader: viewProp.propertyName,
                realPropDisplayName: dispProp,
                realPropName: propertyName,
                isRequired: false
            };
            if( dispProp !== viewProp.uiValue ) {
                prop.isRequired = true;
            }
            let propForMapping = {
                propHeader: viewProp.propertyName,
                realPropDisplayName: dispProp,
                realPropName: viewProp.dbValue,
                isRequired: false
            };
            mappingInfo.push( propForMapping );

            // Go through all types in sheet and see which types should be mapped to prop
            let objTypes = getTypesFromData( data, viewProp );
            for( let typeIndex = 0; typeIndex < objTypes.length; typeIndex++ ) {
                // If this is the first time a prop is being mapped to a type, initiate array. Otherwise,
                // add to array
                if ( typeMapInfos && !typeMapInfos[objTypes[typeIndex]] ) {
                    typeMapInfos[ objTypes[typeIndex] ] = [ prop ];
                } else {
                    typeMapInfos[ objTypes[typeIndex] ].push( prop );
                }
            }
        }
    }

    // Collect mapping information for all sheets
    if ( data.mappingGroupResponse && data.mappingGroupResponse.mappingOutputs ) {
        data.mappingGroupResponse.mappingOutputs.forEach( ( { sheetInfos } ) => {
            sheetInfos.forEach( ( { sheetIndex: sheetNum, typePropInfos, propInfos } ) => {
                if ( !typeSheetMapInfo[sheetNum] ) {
                    typeSheetMapInfo[sheetNum] = { sheetIndex: sheetNum, typePropInfos: {} };
                }
                let currSheetMapInfo = typeSheetMapInfo[sheetNum];
                typePropInfos.forEach( ( { objectType } ) => {
                    const typeMapInfo = typeMapInfos[objectType] || [];

                    // Only process if there are type map info entries
                    if ( typeMapInfo.length > 0 ) {
                        if ( !currSheetMapInfo.typePropInfos[objectType] ) {
                            currSheetMapInfo.typePropInfos[objectType] = [];
                        }

                        // Add properties to the typePropInfos array if they match
                        typeMapInfo.forEach( value => {
                            if ( propInfos.some( prop => prop.propHeader === value.propHeader ) ) {
                                currSheetMapInfo.typePropInfos[objectType].push( value );
                            }
                        } );
                    }
                } );
            } );
        } );
    }

    // Convert the object to an array of values
    let allSheetsMapInfos = Object.values( typeSheetMapInfo );

    return {
        typeMapInfos: typeMapInfos,
        mappingInfo: mappingInfo,
        allSheetsMapInfos:allSheetsMapInfos
    };
};

/**
 * Get input data for Import from Excel
 *
 * @param {Object} data - The view model data
 */
export let getExcelImportInput = function( data ) {
    exports.registerExcelData();
    let importOptions = [];
    let mappingGroupData = {
        groupName: {
            realName: '',
            dispName: '',
            isModifiable: true
        },
        mappingInfo: [],
        actionName: ''
    };
    let mappingGroupData1 = _.clone( mappingGroupData );

    if( data.mappingGroup.dbValue ) {
        mappingGroupData.groupName.realName = data.mappingGroup.dbValue;
        mappingGroupData.groupName.dispName = data.mappingGroup.dbValue;
    }

    let { typeMapInfos, mappingInfo } = getTypeMapInfos( data );

    let actionInfo = {};
    if( _.isEqual( appCtxSvc.getCtx( 'sublocation.clientScopeURI' ), 'Awb0ImportPreview' ) && !data.isMultiSheetImport ) {
        actionInfo = importPreviewSetActionOnLine.populateActionInfoMapForImportSOAInput();
    }
    // If not on preview or if in preview mode it is a multi-sheet import, set folder where structure will be pasted
    else {
        let targetFolder = appCtxSvc.getCtx( 'selected.uid' );
        // It's okay if targetFolder is nulltag, we will paste to Newstuff folder by default
        appCtxSvc.registerCtx( 'awb0ImportBOMTargetFolder', targetFolder );
    }

    if( data.runInBackgroundExcel.dbValue ) {
        let runInBackgroundOption = 'RunInBackground';
        importOptions.push( runInBackgroundOption );
    }

    // Send the correct update scope option depending on the user's selection of the checkboxes
    let structureScopeOption = data.structureScope.dbValue;
    let relationsScopeOption = data.relationsScope.dbValue;
    let partsScopeOption = data.partsScope.dbValue;

    // There can be multiple update scope option selections, add each one
    let scopeOptions = evaluateScopeSelection( structureScopeOption, relationsScopeOption, partsScopeOption );
    for ( let inx = 0; inx < scopeOptions.length; inx++ ) {
        importOptions.push( scopeOptions[inx] );
    }
    let importActionOption = data.structureOptions.dbValue;
    importOptions.push( importActionOption );
    let fileType = data.fileType;
    importOptions.push( fileType );

    // If a mapping group is being used, either add the mapping if new or update if it already exists and a change was made
    if( mappingGroupData.groupName.dispName ) {
        mappingGroupData.mappingInfo = mappingInfo;
        if( mappingGroupData.actionName === '' ) {
            mappingGroupData.actionName = _getActionNameForMapping( data, mappingGroupData );
        }
        if( mappingGroupData.actionName === 'UPDATE' ) {
            let returnObj = {
                headerPropertyMapping: typeMapInfos,
                mappedGroupData: mappingGroupData,
                actionInfo: actionInfo,
                importOptions: importOptions
            };
            _showUpdateNotificationWarning( data, returnObj );
        } else if( mappingGroupData.actionName === '' ) {
            mappingGroupData = mappingGroupData1;
        }
    }
    return {
        headerPropertyMapping: typeMapInfos,
        mappedGroupData: mappingGroupData,
        actionInfo: actionInfo,
        importOptions: importOptions
    };
};

/**
 * Get ActionName For Mapping
 *
 * @param {Object} data - The view model data
 *
 */
let _getActionNameForMapping = function( data, mappingGroupData ) {
    let headerCount = 0;
    let mappingInfo = {};
    let mappingOutputs = {};
    let actionName = 'ADD';
    if( data.mappingGroupResponse.mappingOutputs[ 0 ].mappingGroups.length > 0 ) {
        for( let j = 0; j < data.mappingGroupResponse.mappingOutputs[ 0 ].mappingGroups.length; j++ ) {
            if( data.mappingGroup.dbValue === data.mappingGroupResponse.mappingOutputs[ 0 ].mappingGroups[ j ].dispName ) {
                actionName = '';
                break;
            }
        }
    }
    if( actionName === '' && data.selectedMapping.mappingOutputs[ 0 ].mappingGroups.length === 1 &&
        data.mappingGroup.dbValue === data.selectedMapping.mappingOutputs[ 0 ].mappingGroups[ 0 ].dispName ) {
        if( data.selectedMapping.mappingOutputs[ 0 ].mappingGroups[ 0 ].isModifiable ) {
            actionName = 'UPDATE';
            for( let j = 0; j < data.selectedMapping.mappingOutputs[ 0 ].propInfos.length; j++ ) {
                for( let k = 0; k < mappingGroupData.mappingInfo.length; k++ ) {
                    mappingInfo = mappingGroupData.mappingInfo[ k ];
                    mappingOutputs = data.selectedMapping.mappingOutputs[ 0 ].propInfos[ j ];
                    if( mappingInfo.propHeader === mappingOutputs.propHeader ) {
                        headerCount++;
                        actionName = '';
                        if( mappingInfo.realPropName !== mappingOutputs.realPropName ||
                            mappingInfo.realPropDisplayName !== mappingOutputs.dispPropName ) {
                            actionName = 'UPDATE';
                            break;
                        }
                    }
                }
            }
        } else if( data.selectedMapping.mappingOutputs[ 0 ].mappingGroups[ 0 ].isModifiable === false ) {
            actionName = '';
        }
    }
    if( headerCount !== 0 &&
        ( headerCount < data.selectedMapping.mappingOutputs[ 0 ].propInfos.length || headerCount < mappingGroupData.mappingInfo.length ) ) {
        actionName = 'UPDATE';
    }
    return actionName;
};

/**
 * Show leave warning message
 *
 * @param {Object} data - The view model data
 * @param {Object} returnObj - properties to update on click of cancel/update buttons
 */
let _showUpdateNotificationWarning = function( data, returnObj ) {
    let msg = data.i18n.notificationForUpdateMsg.replace( '{0}', returnObj.mappedGroupData.groupName.dispName );
    let buttons = [ {
        addClass: 'btn btn-notify',
        text: data.i18n.cancel,
        onClick: function( $noty ) {
            $noty.close();
            returnObj.mappedGroupData.actionName = '';
            data.dispatch( { path: 'data.headerPropertyMapping', value: returnObj.headerPropertyMapping } );
            data.dispatch( { path: 'data.mappedGroupData', value: returnObj.mappedGroupData } );
            data.dispatch( { path: 'data.actionInfo', value: returnObj.actionInfo } );
            data.dispatch( { path: 'data.importOptions', value: returnObj.importOptions } );
            eventBus.publish( 'importBOM.importFromExcel' );
        }
    }, {
        addClass: 'btn btn-notify',
        text: data.i18n.update,
        onClick: function( $noty ) {
            $noty.close();
            data.dispatch( { path: 'data.headerPropertyMapping', value: returnObj.headerPropertyMapping } );
            data.dispatch( { path: 'data.mappedGroupData', value: returnObj.mappedGroupData } );
            data.dispatch( { path: 'data.actionInfo', value: returnObj.actionInfo } );
            data.dispatch( { path: 'data.importOptions', value: returnObj.importOptions } );
            eventBus.publish( 'importBOM.importFromExcel' );
        }
    } ];

    notyService.showWarning( msg, buttons );
};

/**
 * Sort the boolean list. True values first
 *
 * @param {Object} list - List to sort
 */
let _sortBooleanList = function( list ) {
    list.sort( function( a, b ) {
        // true values first
        return a.isRequired === b.isRequired ? 0 : a.isRequired ? -1 : 1;
    } );
};
/**
 * Find the given mapping group LOV entry from mapping groups list
 *
 * @param {List} mappingGroupLOV - list of mapping groups
 * @param {Object} mappingGroupName - mapping group entry
 * @returns {Object} mappingGroup - returns mapping group LOV entry if it already exists in list
 */
let _getMappingGroupLOVEntryFromList = function( mappingGroupLOV, mappingGroupName ) {
    for( let index = 0; index < mappingGroupLOV.length; index++ ) {
        let mappingGroup = mappingGroupLOV[ index ];
        if( mappingGroup.propDisplayValue === mappingGroupName.propertyDisplayName ) {
            return mappingGroup;
        }
    }
    return null;
};
/**
 * Find the given LOVEntry in LOVEntries list if it exists
 *
 * @param {List} lovEntries - list of LOV entries
 * @param {Object} potentialEntry - property entry
 * @returns {Object} lovEntry - returns property if it already exists in list
 */
let _checkIfLOVEntryAlreadyExists = function( lovEntries, potentialEntry ) {
    for( let index = 0; index < lovEntries.length; index++ ) {
        let lovEntry = lovEntries[ index ];
        let propertyPropInternalNameOnly = lovEntry.propInternalValue.split( '.' )[1];
        let potentialEntryInternalNameOnly = potentialEntry.propInternalValue.split( '.' )[1];
        // isSecondaryObject check is needed to prevent primary and secondary object properties from merging.
        // For example, primary Item.object_name and secondary ManufacturerPart.object_name
        if( propertyPropInternalNameOnly === potentialEntryInternalNameOnly &&  lovEntry.isSecondaryObject === potentialEntry.isSecondaryObject  ) {
            return lovEntry;
        }
    }
    return null;
};

/**
 * This API checks whether all required properties of business object have been mapped to the properties of excel header or not.
 * This API will return true only if all required properties have been mapped. Otherwise it will return false.
 * @param {*} propForMapping
 */
let isCurrentRequiredPropHasBeenMappedWithExcelHeader = function( vmProps, propForMapping, isSecondaryObjectMappingRequired ) {
    let propertyName = propForMapping.propertyName.split( '.' )[ 1 ];
    let flag = false;

    for( let indexExcelHeaders = 0; indexExcelHeaders < vmProps.length; indexExcelHeaders++ ) {
        let excelHeader = vmProps[ indexExcelHeaders ];
        if( excelHeader.dbValue.length > 0 ) {
            let propNameOfExcelHeader = excelHeader.dbValue.split( '.' )[ 1 ];
            let isPrimaryObjPropMapped = _.isEqual( propNameOfExcelHeader, propertyName );
            let isSecondaryObjectMapped = !isSecondaryObjectMappingRequired || _.isEqual( excelHeader.isSecondaryObject, propForMapping.isSecondaryObject );
            if( isPrimaryObjPropMapped  && isSecondaryObjectMapped ) {
                flag = true;
            }
        }
    }
    return flag;
};

/**
 *
 * This API Return true when all required properties are mapped to Excel header properties for each sheet.
 * Returns 'true' if all required properties are properly mapped, allowing the import operation to proceed.
 * Returns 'false' otherwise, which not enable the Import Structure and preview button in the UI.
 *
 * @returns {Boolean} - true, if all required properties are mapped
 *
 */
let doesCurrentMappingHaveAllReqProps = function( propertiesForMapping, requiredColumnHeadersForAllSheets, vmProps ) {
    for ( let sheetIndex = 0; sheetIndex < requiredColumnHeadersForAllSheets.length; sheetIndex++ ) {
        // Extract headers, object types and secondaryObject Present for the current sheet from the required properties array
        let { headers: headersForCurrentSheet, objectTypes: currSheetObjectTypes, isSecondaryObjectPresent:isSecondaryObjectFound } = requiredColumnHeadersForAllSheets[sheetIndex];
        let filteredVmProps = vmProps.filter( prop => headersForCurrentSheet.includes( prop.propertyName ) );
        let propMapValues = propertiesForMapping.filter( propMap =>
            propMap.isRequired && currSheetObjectTypes.some( type => propMap.propertyName.includes( type ) )
        );

        for ( const propMapValue of propMapValues ) {
            if ( !isCurrentRequiredPropHasBeenMappedWithExcelHeader( filteredVmProps, propMapValue, isSecondaryObjectFound ) ) {
                return false;
            }
        }
    }
    return true;
};

/**
 * Adds internal name of property in parenthesis to property mapping LOVs so properties with duplicate display names
 * can be correctly chosen.
 * @param {*} lovEntries - Array of properties
 * @param {*} duplicateVMProp - View Model Property
 */
let addInternalNamesForDuplicateProps = function( lovEntries ) {
    for ( let inx = 0; inx < lovEntries.length; ++inx ) {
        for ( let jnx = 0; jnx < lovEntries.length; ++jnx ) {
            if ( inx !== jnx &&  lovEntries[inx].defaultDisplayValue === lovEntries[jnx].defaultDisplayValue  ) {
                let propInternalValue = lovEntries[inx].propInternalValue;
                let propInternalNameOnly = propInternalValue.split( '.' )[1];
                // Don't update defaultDisplayValue. Instead, update propDisplayValue so defaultDisplayValue can be used to
                // update other duplicate entry
                lovEntries[inx].propDisplayValue = lovEntries[inx].propDisplayValue + ' (' + propInternalNameOnly + ')';
            }
        }
    }
};

/**
 * Adds property to the array of it is not already available in the passed array.
 * @param {*} arrayOfProps Array of properties
 * @param {*} vmProp : View Model Property
 */
let addPropertyValueToArray = function( arrayOfProps, vmProp ) {
    // If multiple properties with the same display name are added, add internal name in parenthesis
    let isDuplicateProperty = _checkIfLOVEntryAlreadyExists( arrayOfProps, vmProp );
    if ( !isDuplicateProperty ) {
        // Add defaultDisplayValue for checking and updating propDisplayValue of properties with duplicate display values
        let isSecondaryObjectValue = vmProp.isSecondaryObject ? vmProp.isSecondaryObject : false;
        arrayOfProps.push( {
            propDisplayValue: vmProp.propertyDisplayName,
            defaultDisplayValue: vmProp.propertyDisplayName,
            propInternalValue: vmProp.propInternalValue,
            isRequired: vmProp.isRequired,
            isSecondaryObject: isSecondaryObjectValue
        } );
    }
};

/**
 * Reset ViewModelProperty Value
 *
 * @param {ViewModelProperty} viewProp - view model property
 */
let _resetViewModelPropertyValue = function( viewProp ) {
    viewProp.displayValues = [ '' ];
    viewProp.uiValue = '';
    viewProp.dbValue = '';
    viewProp.dbValues = '';
    viewProp.uiValues = '';
    viewProp.isEnabled = true;
    viewProp.dbOriginalValue = '';
};

/**
 * Reset the filter, when subType gets changed.
 *
 * @param {Object} filterBox - filter textBox component
 * @returns {Object} - cleared filter textBox component
 */
export let resetPropertiesFilter = function( filterBox ) {
    let newFilterBox = _.clone( filterBox );
    _resetViewModelPropertyValue( newFilterBox );
    return newFilterBox;
};

/**
 * Add the selected properties in list for mapping
 *
 * @param {Object} sharedData - shared Atomic data
 *
 */
export let addNewPropertiesForMapping = function(  sharedData = {} ) {
    // Switch the active back to the previous panel
    const newSharedData = { ...sharedData.value };
    newSharedData.activeView = 'Awb0ImportFromExcelSub';
    sharedData.update && sharedData.update( newSharedData );
};

/**
 * Action on the filter
 *
 * @param {Object} data - The view model data
 * @param {Object} typePropInfos - type property information (available properties)
 * @param {Object} secTypePropInfos - secondary object type property information (available properties)
 * @param {Object} subType - Selected subType
 * @returns {Array} - array of properties to select filtered based on subType and filter textBox value
 *
 */
export let actionFilterList = function( data, typePropInfos, secTypePropInfos, subType ) {
    let filter = '';
    if( 'filterBox' in data && 'dbValue' in data.filterBox ) {
        filter = data.filterBox.dbValue;
    }
    return _getFilteredProperties( typePropInfos, secTypePropInfos, filter, subType );
};

/**
 * Get the filtered properties
 *
 * @param {Object} typePropInfos - type property information (available properties)
 * @param {Object} secTypePropInfos - secondary object type property information (available properties)
 * @param {Object} filter - Filter value
 * @param {Object} subType - selected subType
 * @returns {Array} - array of properties to select filtered based on subType and filter textBox value
 *
 */
let _getFilteredProperties = function( typePropInfos, secTypePropInfos, filter, subType ) {
    let propertiesToSelect = [];

    // Get propInfos for the selected subType
    let propInfos = _getPropertiesFromSubType( typePropInfos, subType );

    // If propInfos is empty, subType is likely present only in secondary objects
    if ( propInfos.length === 0 ) {
        propInfos = _getPropertiesFromSubType( secTypePropInfos, subType );
    }

    let filterValue = filter.toLocaleLowerCase().replace( /\\|\s/g, '' );

    // We have a filter, don't add properties unless the filter matches
    if( filterValue !== '' ) {
        for( let i = 0; i < propInfos.length; i++ ) {
            let propInfo = propInfos[ i ];
            let propertyName = propInfo.propertyName.toLocaleLowerCase().replace( /\\|\s/g, '' );
            let propertyDisplayName = propInfo.propertyDisplayName.toLocaleLowerCase().replace( /\\|\s/g, '' );
            if( propertyName.indexOf( filterValue ) !== -1 || propertyDisplayName.indexOf( filterValue ) !== -1 ) {
                propertiesToSelect.push( propInfo );
            }
        }
    } else {
        propertiesToSelect = propInfos;
    }

    return propertiesToSelect;
};

/**
 * Get all properties for the selected subtype
 *
 * @param {Object} typePropInfos - type property information (available properties)
 * @param {Object} subType - selected subType
 * @returns {Array} - array of properties to select filtered based on subType
 *
 */
let _getPropertiesFromSubType = function( typePropInfos, subType ) {
    let propertiesToSelect = [];
    for( let index = 0; index < typePropInfos.length; index++ ) {
        let typePropInfo = typePropInfos[ index ];
        if( typePropInfo.objectType === subType ) {
            // eslint-disable-next-line sonarjs/no-empty-collection
            return propertiesToSelect.concat( typePropInfo.propInfos );
        }
    }

    return [];
};

/**
 * Sets the  Import Preview Data. If we are already in importPreview location URI then
 * we clear all updated actions in importPreviewSetActionOnLine list and all loaded VMCs.
 *
 * @param {Object} data - The view model object
 */
export let setImportPreviewData = function( data, isChangeContentImport, changeContentUID ) {
    let { typeMapInfos, mappingInfo, allSheetsMapInfos } = getTypeMapInfos( data );
    let importBOMContext = appCtxSvc.getCtx( 'ImportBOMContext' );
    // For imports from preview or comprehensive error report, retain if the import was initalized from
    // change content so we can return when the import is successful
    let backupisChangeContentImport;
    let backupChangeContentUID;
    if( importBOMContext !== undefined ) {
        backupisChangeContentImport = importBOMContext.isChangeContentImport ? importBOMContext.isChangeContentImport : isChangeContentImport;
        backupChangeContentUID = importBOMContext.changeContentUID ? importBOMContext.changeContentUID : changeContentUID;
    }
    appCtxSvc.registerCtx( 'ImportBOMContext', {
        showPropertiesMap: data.showPropertiesMap,
        fileName: data.fileName,
        fileExt: data.fileExt,
        fileNameNoExt: data.fileNameNoExt,
        files: data.files,
        validFile: data.validFile,
        formData: data.formData,
        fmsTicket: data.fmsTicket,
        response: data.response,
        mappingGroupResponse: data.mappingGroupResponse,
        selectedMapping: data.selectedMapping,
        mappingGroup: data.mappingGroup,
        objectSubTypes: data.objectSubTypes,
        viewModelPropertiesForHeader: data.viewModelPropertiesForHeader,
        columnHeaders: data.columnHeaders,
        secTypePropInfos: data.secTypePropInfos,
        runInBackgroundExcel: data.runInBackgroundExcel,
        propertiesForMapping: data.propertiesForMapping,
        typePropInfos: data.subPanelContext.sharedData.typePropInfos,
        xcFileUploadRequest:data.xcFileUploadRequest,
        typeMapInfos: typeMapInfos,
        isAllSheetsInfoRequired: data.isAllSheetsInfoRequired,
        allSheetsMapInfos: allSheetsMapInfos,
        requiredColumnHeadersForAllSheets: data.requiredColumnHeadersForAllSheets,
        isFileUpdated : data.isFileUpdated,
        isMultiSheetImport: data.isMultiSheetImport,
        fileType: data.fileType,
        showImportOptions: data.showImportOptions,
        structureScope: data.structureScope,
        relationsScope: data.relationsScope,
        partsScope: data.partsScope,
        structureOptions: data.structureOptions,
        isChangeContentImport: backupisChangeContentImport ? backupisChangeContentImport : isChangeContentImport,
        changeContentUID: backupChangeContentUID ? backupChangeContentUID : changeContentUID
    } );
    if( _.isEqual( appCtxSvc.getCtx( 'sublocation.clientScopeURI' ), 'Awb0ImportPreview' ) ) {
        appCtxSvc.updatePartialCtx( 'ImportBOMContext.isImportPreviewScreenOpened', true );
        let vmc = appCtxSvc.getCtx( 'aceActiveContext.context.vmc' );
        vmc.clear();
        appCtxSvc.updatePartialCtx( 'aceActiveContext.context.vmc', vmc );
        importPreviewSetActionOnLine.clearUpdateVMOList();
    }
    // If not on preview, set folder where structure will be pasted
    else {
        let targetFolder = appCtxSvc.getCtx( 'selected.uid' );
        // It's okay if targetFolder is nulltag, we will paste to Newstuff folder by default
        appCtxSvc.registerCtx( 'awb0ImportBOMTargetFolder', targetFolder );
    }
};

/**
 * Sets the Import Preview Data to load and view the 'COMPREHENSIVE_ERROR_REPORT'
 * data that was generated by the "Import Structure" SOA operation when it failed.
 *
 * @param {Object} data - The view model object
 */
export let setImportPreviewErrorReportData = function( data, isChangeContentImport, changeContentUID ) {
    data.fmsTicket = 'COMPREHENSIVE_ERROR_REPORT';
    setImportPreviewData( data, isChangeContentImport, changeContentUID );
};

/**
 * Read the import preview data from saved CTX
 *  @param {Object} data - The view model data
 */
export let getImportPreviewData = function( sharedData = {}, uploadedFileName ) {
    let importBOMContext = appCtxSvc.getCtx( 'ImportBOMContext' );
    if( importBOMContext ) {
        const newSharedData = { ...sharedData.value };
        newSharedData.typePropInfos = importBOMContext.typePropInfos;
        newSharedData.secTypePropInfos = importBOMContext.secTypePropInfos;
        sharedData.update && sharedData.update( newSharedData );
        return {
            showPropertiesMap: importBOMContext.showPropertiesMap,
            fileName: importBOMContext.fileName,
            fileExt: importBOMContext.fileExt,
            fileNameNoExt: importBOMContext.fileNameNoExt,
            files: importBOMContext.files,
            validFile: importBOMContext.validFile,
            formData: importBOMContext.formData,
            fmsTicket: importBOMContext.fmsTicket,
            response: importBOMContext.response,
            mappingGroupResponse: importBOMContext.mappingGroupResponse,
            selectedMapping: importBOMContext.selectedMapping,
            mappingGroup: importBOMContext.mappingGroup,
            objectSubTypes: importBOMContext.objectSubTypes,
            viewModelPropertiesForHeader: importBOMContext.viewModelPropertiesForHeader,
            columnHeaders: importBOMContext.columnHeaders,
            typePropInfos: importBOMContext.typePropInfos,
            secTypePropInfos: importBOMContext.secTypePropInfos,
            runInBackgroundExcel: importBOMContext.runInBackgroundExcel,
            propertiesForMapping: importBOMContext.propertiesForMapping,
            xcFileUploadRequest:importBOMContext.xcFileUploadRequest,
            requiredColumnHeadersForAllSheets:importBOMContext.requiredColumnHeadersForAllSheets,
            isMultiSheetImport : importBOMContext.isMultiSheetImport,
            fileType: importBOMContext.fileType,
            showImportOptions: importBOMContext.showImportOptions,
            structureScope: importBOMContext.structureScope,
            relationsScope: importBOMContext.relationsScope,
            partsScope: importBOMContext.partsScope,
            structureOptions: importBOMContext.structureOptions
        };
    }
};

/**
 * read file name from ctx
 */
export let getPreviewFileData = function( uploadedFileName ) {
    let importBOMContext = appCtxSvc.getCtx( 'ImportBOMContext' );
    if( importBOMContext ) {
        let newUploadedFileName = _.clone( uploadedFileName );
        newUploadedFileName.dbValue = importBOMContext.fileName;
        newUploadedFileName.uiValue = importBOMContext.fileName;
        return{
            uploadedFileName: newUploadedFileName
        };
    }
};


/**
 * Show leave warning message in Preview Screen
 */
export let closeImportPreview = function() {
    let localeTextBundle = localeService.getLoadedText( 'OccmgmtImportExportConstants' );
    let buttons = [ {
        addClass: 'btn btn-notify',
        text: localeTextBundle.stayTitle,
        onClick: function( $noty ) {
            $noty.close();
        }
    },
    {
        addClass: 'btn btn-notify',
        text: localeTextBundle.closeTitle,
        onClick: function( $noty ) {
            $noty.close();
            unRegisterExcelData();
            eventBus.publish( 'importBOMPreview.navigateToBack' );
            if( appCtxSvc.getCtx( 'ImportBOMContext' ) ) {
                appCtxSvc.unRegisterCtx( 'ImportBOMContext' );
            }
        }
    }
    ];
    msgSvc.showWarning( localeTextBundle.notificationForImportPreviewClose, buttons );
};

export let getLOVValues = ( propertiesForMapping ) => {
    let lovEntries = [];
    for( let index = 0; index < propertiesForMapping.length; index++ ) {
        let vmProp = propertiesForMapping[ index ];
        addPropertyValueToArray( lovEntries, vmProp );
    }
    // For properties with duplicate display names, add internal name in parenthesis
    addInternalNamesForDuplicateProps( lovEntries );
    lovEntries.push( {
        propDisplayValue: localeTextBundle.addNew,
        propInternalValue: ADD_NEW_INTERNAL
    } );
    return {
        lovData: lovEntries,
        totalFound: lovEntries.length
    };
};

export let loadMappingGroups = ( mappingGroups, filterString ) => {
    let mappingLOVs = [];
    for( let index = 0; index < mappingGroups.length; index++ ) {
        let entry = mappingGroups[ index ];

        let hasProperty = _getMappingGroupLOVEntryFromList( mappingLOVs, entry );
        // Avoid duplicate mapping groups in list
        if( !hasProperty ) {
            mappingLOVs.push( {
                propDisplayValue: entry.realName,
                propInternalValue: entry.dispName
            } );
        }
    }
    if( filterString && filterString.trim() !== '' ) {
        mappingLOVs = mappingLOVs.filter( function( listVal ) {
            return listVal.propInternalValue.toLowerCase().indexOf( filterString.toLowerCase() ) !== -1 ||
                listVal.propDisplayValue.toLowerCase().indexOf( filterString.toLowerCase() ) !== -1;
        } );
    }
    return mappingLOVs;
};

export let switchView = ( dataProvider, viewModelPropertiesForHeader, propertiesForMapping, requiredColumnHeadersForAllSheets, sharedData = {} ) => {
    let vmProps = _.clone( viewModelPropertiesForHeader );
    for( let i = 0; i < vmProps.length; i++ ) {
        if( vmProps[i].dbValue === ADD_NEW_INTERNAL ) {
            _resetViewModelPropertyValue( vmProps[i] );
            const newSharedData = { ...sharedData.value };
            newSharedData.activeView = 'Awb0AddPropertiesSub';
            sharedData.update && sharedData.update( newSharedData );
            break;
        }
    }
    let allRequiredPropMapped = doesCurrentMappingHaveAllReqProps( propertiesForMapping, requiredColumnHeadersForAllSheets, vmProps );
    return {
        viewModelPropertiesForHeader: vmProps,
        isAwb0ImportButtonIsVisible: allRequiredPropMapped
    };
};

export const backActionData = ( sharedData ) => {
    let newSharedData = { ...sharedData };
    newSharedData.activeView = 'Awb0ImportFromExcelSub';
    return newSharedData;
};

let addSubType = ( objectSubTypes, objectType ) => {
    let found = objectSubTypes.find( existingSubType => existingSubType.propDisplayValue === objectType.propDisplayValue );
    if ( !found ) {
        objectSubTypes.push( objectType );
    }
    return objectSubTypes;
};

export let getObjectSubTypes = ( typePropInfos, secTypePropInfos ) => {
    let objectSubTypes = [];
    // Get primary object sub types
    for( let index = 0; index < typePropInfos.length; index++ ) {
        let typePropInfo = typePropInfos[ index ];
        let objectType = {
            propDisplayValue: typePropInfo.dispTypeName,
            propInternalValue: typePropInfo.objectType
        };
        // Prevent duplicate item types from appearing
        objectSubTypes = addSubType( objectSubTypes, objectType );
    }
    // Get secondary object sub types
    for( let index = 0; index < secTypePropInfos.length; index++ ) {
        let secTypePropInfo = secTypePropInfos[ index ];
        let objectType = {
            propDisplayValue: secTypePropInfo.dispTypeName,
            propInternalValue: secTypePropInfo.objectType
        };
        // Prevent duplicate item types from appearing
        objectSubTypes = addSubType( objectSubTypes, objectType );
    }
    return objectSubTypes;
};

export let validateMappingGroup = ( data ) => {
    if( data.mappingGroup.dbValue !== '' ) {
        let idxOfUserTextInMapping = -1;
        // If user has typed in value then we need to know if it is valid
        idxOfUserTextInMapping = _.findIndex( data.mappingLOVs,
            function( mapping ) { return mapping.propInternalValue === data.mappingGroup.dbValue; }
        );
        if( idxOfUserTextInMapping !== -1 ) {
            eventBus.publish( 'importBOM.populateMappingGroups' );
        }
    } else {
        let newViewModelPropertiesForHeader = destroyExistingVMOAndReCreateVMOForHeaders( data );
        return {
            viewModelPropertiesForHeader: newViewModelPropertiesForHeader,
            isAwb0ImportButtonIsVisible: false
        };
    }
};

/**
 * Update typePropInfos / secTypePropInfos when a property is selected / deselected from the "Add Properties" subpanel
 */
export let updateProperties = ( data ) => {
    let typePropInfos = data.subPanelContext.sharedData.typePropInfos;
    let secTypePropInfos = data.subPanelContext.sharedData.secTypePropInfos;
    for( let j = 0; j < typePropInfos.length; j++ ) {
        let typePropInfo = typePropInfos[ j ];
        if( typePropInfo.objectType === data.subTypes.dbValue ) {
            let propInfos = typePropInfo.propInfos;
            for( let i = 0; i < data.propertiesToSelect.length; i++ ) {
                let vmProp = data.propertiesToSelect[ i ];
                for( let k = 0; k < propInfos.length; k++ ) {
                    if( vmProp.propInternalValue === propInfos[ k ].propInternalValue ) {
                        propInfos[ k ] = vmProp;
                    }
                }
            }
            typePropInfos[ j ].propInfos = propInfos;
            break;
        }
    }
    for( let j = 0; j < secTypePropInfos.length; j++ ) {
        let secTypePropInfo = secTypePropInfos[ j ];
        if( secTypePropInfo.objectType === data.subTypes.dbValue ) {
            let propInfos = secTypePropInfo.propInfos;
            for( let i = 0; i < data.propertiesToSelect.length; i++ ) {
                let vmProp = data.propertiesToSelect[ i ];
                for( let k = 0; k < propInfos.length; k++ ) {
                    if( vmProp.propInternalValue === propInfos[ k ].propInternalValue ) {
                        propInfos[ k ] = vmProp;
                    }
                }
            }
            secTypePropInfos[ j ].propInfos = propInfos;
            break;
        }
    }
    const newSharedData = { ...data.subPanelContext.sharedData.value };
    newSharedData.typePropInfos = typePropInfos;
    newSharedData.secTypePropInfos = secTypePropInfos;
    data.subPanelContext.sharedData.update && data.subPanelContext.sharedData.update( newSharedData );
};

export let resetView = ( popupId ) => {
    let locationContext = appCtxSvc.getCtx( 'locationContext' );
    if( locationContext['ActiveWorkspace:Location'] === 'com.siemens.splm.clientfx.tcui.xrt.showObjectLocation' ) {
        eventBus.publish( 'occTreeTable.plTable.reload' );
        dialogService.closeDialog( '', popupId );
    }
};

export let createURLAndLaunchChangeContent = function( objectToBeOpened, revisionRuleUid ) {
    // For imports initiated from preview, the parameter passed in for objectToBeOpened
    // will be undefined as the UID for the change notice is no longer available. In that case,
    // we can get the UID from ImportBOMContext
    if( !objectToBeOpened ) {
        let changeContentUID = appCtxSvc.getCtx( 'ImportBOMContext.changeContentUID' );
        if ( changeContentUID ) {
            objectToBeOpened = changeContentUID;
        }
        if( !objectToBeOpened ) {
            throw 'Mandatory argument objectToBeOpened not defined.';
        }
    }
    if ( !revisionRuleUid ) {
        throw 'Mandatory argument revisionRuleUid not defined.';
    }

    var transitionTo = 'com_siemens_splm_clientfx_tcui_xrt_showObject';
    var toParams = {};

    toParams.pageId = 'tc_xrt_ChangeContent';
    toParams.uid = objectToBeOpened;

    var options = {};
    options.reload = true;

    AwStateService.instance.go( transitionTo, toParams, options );
};

export let setInitialValueForSubType = ( subTypes, objectSubTypes ) => {
    if( objectSubTypes && objectSubTypes.length > 0 ) {
        let subTypesCopy = { ...subTypes };
        subTypesCopy.uiValue = objectSubTypes[0].propDisplayValue;
        subTypesCopy.dbValue = objectSubTypes[0].propInternalValue;
        return subTypesCopy;
    }
};


export let getDataProperties = function( data ) {
    let fileName = data.fileName;
    let fileNameNoExt = data.fileNameNoExt;
    let formData = data.formData;
    let fileExt = data.fileExt;
    let validFile;
    if( fileExt === 'xlsx' || fileExt === 'xlsm' ) {
        validFile = data.validFile;
    }else{
        validFile = false;
    }
    return{
        fileName,
        fileNameNoExt,
        validFile,
        formData,
        fileExt
    };
};

export let getUploadFileMicroServiceURL = function() {
    return browserUtils.getBaseURL() + 'sd/xccshare/uploadFileToFMS';
};

/**
 *
 * @param {Object} fileSelData - VMO
 * @returns {Object} - Import REST API Body
 */
export let getCreateRequestJSONForImport = function( fileSelData ) {
    var selectedFile = fileSelData.selectedFile;
    var projectId = selectedFile.projectId;
    var projectName = selectedFile.projectName;

    var urn = selectedFile.urn;
    var fileName = selectedFile.Title; //user selected file from Xcc


    var userSession = appCtxSvc.getCtx( 'userSession' );
    var userId = userSession.props.user_id.dbValue;
    var groupId = userSession.props.group_name.dbValue;

    /* beautify preserve:start */

    return '{' +
        '"zeusFileInfo": {' +
        '"project": "' + projectId + '",' +
        '"projectName": "' + projectName + '",' +
        '"name": "' + fileName + '",' +
        '"urn": "' + urn + '",' +
        '"length": -1' +
        '},' +
        '"fileName": "' + fileName + '",' +
        '"userId":"' + userId + '",' +
        '"groupId": "' + groupId + '"' +
        '}';
    /* beautify preserve:end */
};

export let xcUploadFileToFMS = function( addReqInp ) {
    var $http = AwHttpService.instance;
    var deferred = AwPromiseService.instance.defer();

    var postPromise = $http.post( getUploadFileMicroServiceURL(), addReqInp, {
        headers: {
            'Content-Type': 'application/json'
        }
    } );

    if( postPromise ) {
        postPromise.then( function( response ) {
            handleSuccessResponse( response );
            var respData = response.data;
            var ticket = respData.ticket;
            appCtxSvc.registerCtx( 'importFmsTicket', ticket );
            deferred.resolve( {
                fmsTicket: ticket
            } );
        }, function( err ) {
            handleFailedResponse( err );
            deferred.reject( 'Internal error occurred during operation. Contact your administrator' );
        } );
    }
    return deferred.promise;
};

/**
 * handle the failed error message thrown by micro services
 * @param {Object} err -VMO
 */
export let handleFailedResponse = function( err ) {
    var errResponse = err.response;

    if ( errResponse && errResponse.data ) {
        if ( errResponse.data.message ) {
            msgSvc.showError( errResponse.data.message );
        } else if ( errResponse.data.partialErrors && errResponse.data.partialErrors.length > 0
            && errResponse.data.partialErrors[0].errorValues && errResponse.data.partialErrors[0].errorValues.length > 0 ) {
            msgSvc.showError( errResponse.data.partialErrors[0].errorValues[0].message );
        } else if ( errResponse.data instanceof String ) {
            msgSvc.showError( errResponse.data );
        } else {
            msgSvc.showError( 'Internal error occurred during operation. Contact your administrator' );
        }
    } else {
        msgSvc.showError( 'Internal error occurred during operation. Contact your administrator' );
    }
};

/**
 * handle the sucess/failed message thrown by micro services
 * @param {Object} response -VMO
 */
export let handleSuccessResponse = function( response ) {
    var respData = response.data;
    if ( respData.message && respData.message.isError ) {
        var msg = respData.message.reason;
        if ( respData.message.isError === 'true' ) {
            msgSvc.showError( msg );
        } else {
            msgSvc.showInfo( msg );
        }
    }
};

/**
 * checks the file based on the extension and validates.
 * @param {*} fileExt
 */
export let isLoadedFileValid = function( fileExt ) {
    var resource = 'OccmgmtImportExportConstants';
    var localTextBundle = _localeSvc.getLoadedText( resource );
    let failureMsg = '';

    if( fileExt !== 'xlsx' || fileExt !== 'xlsm' ) {
        failureMsg = localTextBundle.invalidFile;
        msgSvc.showError( failureMsg );
    }
};

/**
 * When reuploading an excel file, reselect the previously used mapping group if one was used.
 * @param {*} mappingGroup
 */
export let restorePreviousMappingGroup = function( mappingGroup ) {
    if ( mappingGroup.prevDbValue && mappingGroup.prevDbValue !== '' ) {
        mappingGroup.dbValue = mappingGroup.prevDbValue;
    }
    if ( mappingGroup.prevUiValue && mappingGroup.prevUiValue !== '' ) {
        mappingGroup.uiValue = mappingGroup.prevUiValue;
    }

    return mappingGroup;
};

/**
 * Gets the internal property name from the inputted VMO
 * @param {Object} vmo - The ViewModelObject being hovered on
 * @returns {String} tooltip - The internal property name text
 */
export let showInternalPropTooltip = function( vmo ) {
    let tooltip;
    let propInternalValue = vmo.propInternalValue;
    let propInternalNameOnly = propInternalValue.split( '.' )[1];

    tooltip = uwPropertyService.createViewModelProperty( '', '', 'STRING', '', '' );
    uwPropertyService.setDisplayValue( tooltip, [ propInternalNameOnly ] );
    tooltip.propertyLabelDisplay = 'NO_PROPERTY_LABEL';

    return tooltip;
};

/**
 * Call Soa with unit system header state override
 * Overriding unit system header state to maintain import structure properties
 * to work with desired values and not converted values always.
 *
 * @param {String} serviceName - The name of the SOA service to call.
 * @param {String} operationName - The name of the operation within the SOA service.
 * @param {Object} soaInput - The input object for the SOA operation.
 * @param {String} unitSystemInput - The input unit system for the SOA operation.
 * @returns {Promise} - A promise resolving to the SOA response.
 */
export let callSOAWithUnitSysStateOverride = function( serviceName, operationName, unitSystemInput, soaInput ) {
    let headerStateOverride = {
        unitSystem: unitSystemInput
    };
    return soaSvc.postUnchecked( serviceName, operationName, soaInput, null, false, headerStateOverride )
        .then( function( response ) {
            return response;
        }
        );
};

export let getImportPanelTitle = function( i18n, ctx ) {
    let importPanelTitle = i18n.importTitle;

    if ( ctx.preferences.EnableNewAwp0XlsImport && ctx.preferences.EnableNewAwp0XlsImport[0] === 'true' ) {
        importPanelTitle = i18n.importFromExcelTitle;
    }

    return importPanelTitle;
};

export let getImportButtonTitle = function( i18n, ctx ) {
    let importButtonTitle = i18n.importTitle;

    if ( ctx.preferences.EnableNewAwp0XlsImport && ctx.preferences.EnableNewAwp0XlsImport[0] === 'true' ) {
        importButtonTitle = i18n.importFromExcelButtonTitle;
    }

    return importButtonTitle;
};

export let setImportOptions = function( ctx, showPropertiesMap, mappingGroupResponse, structureScope, relationsScope, partsScope ) {
    let prefEnabled = Boolean( ctx.preferences.EnableNewAwp0XlsImport && ctx.preferences.EnableNewAwp0XlsImport[0] === 'true' );

    let fileType = 'unknownFileType';

    // Set default update scope according to mappingGroupResponse data
    let typePropInfos = mappingGroupResponse.mappingOutputs[0].typePropInfos;

    // For 3rd party, typePropInfos will be populated, set scope to All and update file type
    if ( typePropInfos.length > 0 ) {
        // Set the update scope options
        structureScope.dbValue = true;
        relationsScope.dbValue = true;
        partsScope.dbValue = true;

        fileType = 'external';

        // Properties map is needed for 3rd party files
        showPropertiesMap = true;
    // For round trip, typePropInfos will not be populated, read mapping group response to determine scope
    // Disable the mapping panel as well
    // Also update file type
    } else {
        let fileContent = [];
        let fileContentFromServer = mappingGroupResponse.mappingOutputs[0].mappingGroups;
        for ( let inx = 0; inx < fileContentFromServer.length; ++inx ) {
            fileContent.push( fileContentFromServer[inx].dispName );
        }

        // Now that we have the file type(s), determine which update scope button will be set by default
        // For parts, default scope is parts only
        if ( fileContent.includes( RT_PARTS ) ) {
            structureScope.dbValue = false;
            relationsScope.dbValue = false;
            partsScope.dbValue = true;
            fileType = RT_PARTS;
        // For structures, default scope is structure only
        } else if ( fileContent.includes( RT_STRUCTURE ) ) {
            structureScope.dbValue = true;
            relationsScope.dbValue = false;
            partsScope.dbValue = false;
            fileType = RT_STRUCTURE;
        // For relations, default scope is relation only
        } else if ( fileContent.includes( RT_RELATIONS ) ) {
            structureScope.dbValue = false;
            relationsScope.dbValue = true;
            partsScope.dbValue = false;
            fileType = RT_RELATIONS;
        }

        // For round trip, properties map is not needed
        showPropertiesMap = false;
    }

    return {
        enableImportActions: prefEnabled,
        showPropertiesMap: showPropertiesMap,
        structureScope: structureScope,
        relationsScope: relationsScope,
        partsScope: partsScope,
        fileType: fileType
    };
};

export default exports = {
    registerExcelData,
    updateFormData,
    resetExcelImportData,
    unRegisterExcelData,
    createPropertiesMap,
    getExcelImportInput,
    populateMappingInfoForGroup,
    resetPropertiesFilter,
    addNewPropertiesForMapping,
    actionFilterList,
    setImportPreviewData,
    setImportPreviewErrorReportData,
    getImportPreviewData,
    closeImportPreview,
    enableImportStructureButtonInPanel,
    getLOVValues,
    loadMappingGroups,
    switchView,
    backActionData,
    getObjectSubTypes,
    updatePropertiesForMapping,
    validateMappingGroup,
    updateProperties,
    resetView,
    createURLAndLaunchChangeContent,
    setInitialValueForSubType,
    getDataProperties,
    handleFailedResponse,
    handleSuccessResponse,
    getCreateRequestJSONForImport,
    xcUploadFileToFMS,
    isLoadedFileValid,
    getPreviewFileData,
    restorePreviousMappingGroup,
    showInternalPropTooltip,
    callSOAWithUnitSysStateOverride,
    getImportPanelTitle,
    getImportButtonTitle,
    setImportOptions
};
