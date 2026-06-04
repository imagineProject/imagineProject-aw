// Copyright (c) 2022 Siemens

/**
 * @module js/pca0InlineAuthoringHandler
 */
import appCtxService from 'js/appCtxService';
import awPromiseService from 'js/awPromiseService';
import awTableTreeSvc from 'js/splmTablePublishedTreeService';
import cdm from 'soa/kernel/clientDataModel';
import { constants as veConstants } from 'js/pca0VariabilityExplorerConstants';
import dataSourceService from 'js/dataSourceService';
import editHandlerSvc from 'js/editHandlerService';
import eventBus from 'js/eventBus';
import iconSvc from 'js/iconService';
import localeService from 'js/localeService';
import messagingService from 'js/messagingService';
import parsingUtils from 'js/parsingUtils';
import pca0CommonUtils from 'js/pca0CommonUtils';
import pca0ConfiguratorExplorerCommonUtils from 'js/pca0ConfiguratorExplorerCommonUtils';
import pca0Constants from 'js/Pca0Constants';
import pca0InlineAuthoringEditService from 'js/pca0InlineAuthoringEditService';
import pca0VCAUtils from 'js/pca0VCAUtils';
import pca0VariabilityExplorerService from 'js/pca0VariabilityExplorerService';
import pca0VariabilityTreeDisplayService from 'js/Pca0VariabilityTreeDisplayService';
import pcaObjectTypeLOVComponentService from 'js/PcaObjectTypeLOVComponentService';
import soaSvc from 'soa/kernel/soaService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import _ from 'lodash';

const _localeTextBundle = localeService.getLoadedText( 'ConfiguratorExplorerMessages' );

const _familyNamespaceProp = 'cfg0FamilyNamespace';
const _freeformProp = 'cfg0HasFreeFormValues';
const _multiSelectProp = 'cfg0IsMultiselect';
const _objectIdProp = 'cfg0ObjectId';
const _objectNameProp = 'object_name';
const _objectTypeProp = 'object_type';
const _optionalProp = 'cfg0IsDiscretionary';
const _valueDataTypeProp = 'cfg0ValueDataType';

/**
 * Returns View Model Tree Node for the input model object
 * @param {Object} modelObj - The model object
 * @param {Object} parentNode - The parent node for modelObj
 * @param {Object} reuseMode - reuse mode flag from ctx
 * @returns {Object} - View Model Tree Node object
 */
let _createViewModelTreeNodeUsingVMO = function( modelObj, parentNode, reuseMode ) {
    // Get child node level index
    let childlevelIndex = 0;
    if( parentNode ) {
        childlevelIndex = parentNode.levelNdx + 1;
    }

    // Create view model tree node
    let iconURL = iconSvc.getTypeIconURL( modelObj.absType );
    let childIdx = parentNode.childNdx;

    // Get display name
    let displayName = _getInlineRowDisplayName( modelObj.absType );

    let vmNode = awTableTreeSvc.createViewModelTreeNode( modelObj.uid, modelObj.type, displayName, childlevelIndex, childIdx, iconURL );

    vmNode.isLeaf = true;
    vmNode.getId = function() {
        return this.uid;
    };
    // For allocation use case to show specific features of a family we need the Server uid of the allocation row.
    //TODO: Keep a separate property to store client generated id, instead of using uid
    if( reuseMode && parentNode.isEditing ) {
        vmNode.parentServerUID = parentNode.serverUid;
    }
    vmNode.parentUID = parentNode.uid;
    vmNode.isInlineRow = true;

    return vmNode;
};

/**
 * Returns display value for inline row
 * @param {Object} inlineRowVMOType - The model object type
 * @returns {String} - The display value for inline row
 */
let _getInlineRowDisplayName = function( inlineRowVMOType ) {
    let displayName;
    // set display name based on type
    switch ( inlineRowVMOType ) {
        case pca0Constants.CFG_OBJECT_TYPES.ABS_FAMILY_GROUP:
            displayName = _localeTextBundle.Pca0NewGroup;
            break;
        case pca0Constants.CFG_OBJECT_TYPES.ABS_LITERAL_VALUE_FAMILY:
        case pca0Constants.CFG_OBJECT_TYPES.ABS_PRODUCT_MODEL_FAMILY:
        case pca0Constants.CFG_OBJECT_TYPES.ABS_SUMMARY_MODEL_FAMILY:
        case pca0Constants.CFG_OBJECT_TYPES.ABS_PRODUCT_LINE_FAMILY:
            displayName = _localeTextBundle.Pca0NewFamily;
            break;
        case pca0Constants.CFG_OBJECT_TYPES.TYPE_REVISION:
            displayName = _localeTextBundle.Pca0NewFeature;
            break;
        case pca0Constants.CFG_OBJECT_TYPES.ABS_SUMMARY_OPTION_VALUE:
            displayName = _localeTextBundle.Pca0NewSummaryFeature;
            break;
        case pca0Constants.CFG_OBJECT_TYPES.ABS_PACKAGE_OPTION_VALUE:
            displayName = _localeTextBundle.Pca0NewPackageFeature;
            break;
        case pca0Constants.CFG_OBJECT_TYPES.ABS_FEATURE:
            displayName = _localeTextBundle.Pca0NewStandAloneFeature;
            break;
        case pca0Constants.CFG_OBJECT_TYPES.TYPE_PRODUCT_MODEL:
        case pca0Constants.CFG_OBJECT_TYPES.ABS_SUMMARY_MODEL:
        case pca0Constants.CFG_OBJECT_TYPES.ABS_PRODUCT_LINE:
            displayName = _localeTextBundle.Pca0NewModel;
            break;
        default:
            displayName = _localeTextBundle.Pca0NewElement;
            break;
    }
    return displayName;
};

/**
 * Add inline row into View Model Object list
 * @param {Object} treeDataProvider - tree Data Provider
 * @param {Object} parentNode - parent node object under which inline row to be added
 * @param {Object} childVMO - inline row view model object to view model object collection
 */
let _insertInlineRow = function( treeDataProvider, parentNode, childVMO ) {
    {
        //Switching to Feature tab will fetch all direct children of ProductItem i.e. Group and switching to Model Tab
        //will fetch direct children of ProductItem i.e. Model Families. So no need to expand ProductItem again if parentNode is product Item.
        //Hence setting isExpanded flag to true.
        if( parentNode.type === pca0Constants.CFG_OBJECT_TYPES.TYPE_PRODUCT_ITEM ) {
            parentNode.isExpanded = true;
        }
        //For cached data we are getting isExpanded prop as undefined, manually setting it to false
        if( _.isUndefined( parentNode.isExpanded ) ) {
            parentNode.isCached = true;
        } else {
            parentNode.isCached = false;
        }
        // expand parent node if not already expanded
        if( !parentNode.isInlineRow && !parentNode.isExpanded ) {
            eventBus.publish( treeDataProvider.name + '.expandTreeNode', {
                parentNode: parentNode
            } );
        }
    }

    // Insert the new treeNode in the viewModelCollection at the correct location
    let viewModelCollection = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    let expectedInlineRowIdx = viewModelCollection.findIndex( obj => obj.uid === parentNode.uid );
    viewModelCollection.splice( ++expectedInlineRowIdx, 0, childVMO );

    // Add the new treeNode to the parentVMO and update view model collection
    exports.addChildToParentsChildrenArray( parentNode, childVMO, parentNode.childNdx );

    // Updating the parent node in the viewModelCollection
    viewModelCollection.splice( --expectedInlineRowIdx, 1, parentNode );
    treeDataProvider.update( viewModelCollection );
    treeDataProvider.setSelectionEnabled( true );
};

/**
 * Creates a data source for edit handler
 * @param {Object} dataProviders - data providers
 * @return {Object} dataSource instance
 */
let _createDataSource = function( dataProviders ) {
    let declViewModel = {};
    declViewModel.dataProviders = dataProviders;
    return dataSourceService.createNewDataSource( {
        declViewModel: declViewModel
    } );
};

/**
 * This method will update the cfg0MaximumValue and cfg0MinimumValue's properties as in updatePropValMap
 *
 * @param {Object} widgetVmo - widget currently having the selection change that triggers the confirmation
 * @param {Object} updatePropValMap - property to value map object which is used for updating cfg0MaximumValue, and cfg0MinimumValue
 */
let _updateMinMaxValueDataType = function( widgetVmo, updatePropValMap ) {
    Object.keys( updatePropValMap ).forEach( property => {
        if( !_.isUndefined( widgetVmo.props.cfg0MaximumValue ) ) {
            widgetVmo.props.cfg0MaximumValue[ property ] = updatePropValMap[ property ];
        }
        if( !_.isUndefined( widgetVmo.props.cfg0MinimumValue ) ) {
            widgetVmo.props.cfg0MinimumValue[ property ] = updatePropValMap[ property ];
        }
    } );
    viewModelObjectSvc.updateVMOProperties( widgetVmo );
};

/**
 * remove child node from parent by the given child UID
 * @param {Object} parentNode Parent node
 * @param {Object} childUid UID of children
 */
let _removeChildFromParent = function( parentNode, childUid ) {
    let inlineRowIdxFromChildArray = parentNode.children.findIndex( obj => obj.uid === childUid );
    if( inlineRowIdxFromChildArray !== -1 ) {
        parentNode.children.splice( inlineRowIdxFromChildArray, 1 );
    }

    //Removing the expand button if the parent doesn't have any children.
    if( parentNode.children.length === 0 ) {
        parentNode.isLeaf = true;
    }
};

/**
 * Returns create input object for unsaved row vmo
 * @param {Object} unsavedRow - Unsaved row vmo
 * @param {Object} treeDataProvider Tree data provider
 * @param {Object} isFamilyNamespaceColumnVisible - visibility of family namespace column
 * @returns {Object} - Returns an object containing create input object and parent node
 */
let _populateCreateObjectInput = function( unsavedRow, treeDataProvider, isFamilyNamespaceColumnVisible ) {
    let creInput = {};
    //LCS-730556 - Getting error while creating Custom Data in AW
    creInput = _populateInputStringProps( treeDataProvider, unsavedRow.viewModelObject.uid, isFamilyNamespaceColumnVisible );
    if( _.isUndefined( creInput.propertyNameValues.object_type ) ) {
        creInput.boName = unsavedRow.viewModelObject.type;
    } else if( !_.isEmpty( creInput.propertyNameValues.object_type[ 0 ] ) ) {
        creInput.boName = creInput.propertyNameValues.object_type[ 0 ];
        delete creInput.propertyNameValues.object_type;
    }
    let parentNode = unsavedRow.parentNode;
    return { creInput, parentNode };
};

/**
 * Retrieves valid property values from the given array of values.
 * Filters out falsy values (null, undefined, empty string) and returns an array of valid values.
 * Returns [''] if no valid values are found.
 *
 * @param {Object} values - dbValues of the property.
 * @returns {Array} - prop values array
 */
const _getValidPropValues = ( values ) => {
    // Check if values is an array and has valid values
    const emptyStringArray = [ '' ];
    if ( !Array.isArray( values ) || values.length === 0 || _.isNull( values[0] ) ) {
        return emptyStringArray;
    }

    // Filter out falsy values (null, undefined, empty string)
    let updatedValues = values.filter( Boolean );

    // If no valid values remain, return an array with an empty string, otherwise return the values
    return updatedValues.length > 0 ? updatedValues : emptyStringArray;
};

/**
 * Returns string property map based on pre populated values from VMO and updates it with any modification user did
 * @param {Object} treeDataProvider - Tree data provider
 * @param {Object} uid - Uid of a row to be saved
 * @param {Object} isFamilyNamespaceColumnVisible - visibility of family namespace column
 * @returns {Object} - Returns the parent node uid
 */
let _populateInputStringProps = function( treeDataProvider, uid, isFamilyNamespaceColumnVisible ) {
    let stringProps = {
        boName: '',
        propertyNameValues: {},
        compoundCreateInput: {}
    };

    const inlineRowVmo = pca0ConfiguratorExplorerCommonUtils.getInlineRowByUid( treeDataProvider, uid );
    _.forEach( inlineRowVmo.props, function( prop ) {
        if( prop.isEditable && prop.propertyName !== _objectTypeProp && prop.propertyName !== _objectNameProp ) {
            stringProps.propertyNameValues[ prop.propertyName ] = _getValidPropValues( prop.dbValues );
        }
    } );

    const rowDirtyProps = inlineRowVmo.getSaveableDirtyProps();
    if ( rowDirtyProps?.length > 0 ) {
        rowDirtyProps.forEach( ( { name, values } ) => {
            if ( name && values ) {
                stringProps.propertyNameValues[name] = _getValidPropValues( values );
            }
        } );
    }

    // Removing those properties which are empty, We should not sent empty properties to server.
    for ( const prop in stringProps.propertyNameValues ) {
        if ( _.isArray( stringProps.propertyNameValues[prop] ) ) {
            stringProps.propertyNameValues[prop].forEach( function( value ) {
                // Check if the value is empty, does not have the "cfg0FamilyNamespace" property, and the family namespace column is not visible.
                // If the value is empty and does not have the "cfg0FamilyNamespace" property, remove the property from stringProps.
                // If the value is empty and the family namespace column is visible, do not remove the property as the family is expected to be created with empty values.
                if ( _.isEmpty( value ) && !value.hasOwnProperty( _familyNamespaceProp ) && !isFamilyNamespaceColumnVisible ) {
                    delete stringProps.propertyNameValues[prop];
                }
            } );
        }
    }
    return stringProps;
};

/**
 * Checks if product model family is available in the viewModelCollection
 * @param {Object} viewModelCollection - View model collection
 * @returns {Boolean} - Returns true if product model family is available false otherwise
 */
let _isProductModelFamilyAvailable = function( viewModelCollection ) {
    let vmos = viewModelCollection.getLoadedViewModelObjects();
    return vmos.some( inlineRow => inlineRow.absType === pca0Constants.CFG_OBJECT_TYPES.ABS_PRODUCT_MODEL_FAMILY ||
         inlineRow.modelType?.typeHierarchyArray.includes( pca0Constants.CFG_OBJECT_TYPES.ABS_PRODUCT_MODEL_FAMILY ) );
};

/**
 * Updates the properties of Value data type from previous selected type.
 * @param {Object} vmo - vmo of the selected parent row
 */
let _updateValueDataTypeProperties = function( vmo ) {
    let previousSelectedLovs = vmo.props.cfg0ValueDataType.previousSelectedLovs[ 0 ];
    let prevLovUIValue = previousSelectedLovs.uiValue;
    let prevLovDBValue = previousSelectedLovs.dbValue;
    let valueDataTypeProp = vmo.props.cfg0ValueDataType;

    valueDataTypeProp.dbValue = prevLovDBValue;
    valueDataTypeProp.dbValues = [ prevLovDBValue ];
    valueDataTypeProp.uiValue = prevLovUIValue;
    valueDataTypeProp.uiValues = [ prevLovUIValue ];
};

/**
 * Updates the properties of Object type from previous selected type.
 * @param {Object} vmo - vmo of the selected parent row
 */
let _updateObjectTypeProperties = function( vmo ) {
    let prevLovValue = vmo.props.object_type.previousSelectedLovs[ 0 ].uiValue;
    let prevVmo = vmo.props.object_type.objectTypesCachedValues.find( function( row ) {
        return prevLovValue === row.dispValue;
    } );
    if( prevVmo ) {
        let prevLovUIValue = prevVmo.propDisplayValue;
        let prevLovDBValue = prevVmo.propInternalValue;

        let objectTypeProp = vmo.props.object_type;
        objectTypeProp.dbValue = prevLovDBValue;
        objectTypeProp.dbValues = [ prevLovDBValue ];
        objectTypeProp.displayValues = [ prevLovUIValue ];
        objectTypeProp.uiValues = [ prevLovUIValue ];
        objectTypeProp.uiValue = prevLovUIValue;
        objectTypeProp.value = prevLovDBValue;
    }
};

/**
 * This function will sort the rows based on level index of rows.
 * @param {Object} rows - rows to be sorted by level
 * @param {Object} treeDataProvider - Tree data provider
 * @param {Array} existingVMOUidList - existing uid array
 * @returns {Object} - levelwise sorted map - rowIndex 1 for groups, rowIndex 2 for families and rowIndex 3 for features
 */
let _levelBasedSort = function( rows, treeDataProvider, existingVMOUidList ) {
    // rowIndex 1 for groups, rowIndex 2 for families and rowIndex 3 for features
    let levelRowMap = new Map();
    let levelOne = [];
    let levelTwo = [];
    let levelThree = [];
    // Create a copy of the rows array
    let rowsCopy = [ ...rows ];
    // Iterate through the existingVMOUidList and find matching rows in rowsCopy
    const viewModelCollection = treeDataProvider.getViewModelCollection();
    existingVMOUidList.forEach( existingVMOUid => {
        // Find the row with matching viewModelObject.uid in rowsCopy
        let rowFoundIndex = rowsCopy.findIndex( row => row.viewModelObject.uid === existingVMOUid );
        if ( rowFoundIndex !== -1 ) { // If the row is found in rowsCopy
            let existingInlineRowIdx = viewModelCollection.findViewModelObjectById( rowsCopy[rowFoundIndex].viewModelObject.uid );
            if( existingInlineRowIdx !== -1 ) {
                let inlineVMO = viewModelCollection.getViewModelObject( existingInlineRowIdx );
                if( inlineVMO.levelNdx === 1 ) {
                    levelOne.push( rowsCopy[rowFoundIndex] );
                }else if( inlineVMO.levelNdx === 2 ) {
                    levelTwo.push( rowsCopy[rowFoundIndex] );
                }else if( inlineVMO.levelNdx === 3 ) {
                    levelThree.push( rowsCopy[rowFoundIndex] );
                }
            }
            // Remove the found row from rowsCopy using splice
            rowsCopy.splice( rowFoundIndex, 1 );
        } else if ( rowsCopy.length === 0 ) {
            // If rowsCopy is empty and no more rows can be found, break the loop
            return;
        }
    } );
    levelRowMap.set( 1, levelOne );
    levelRowMap.set( 2, levelTwo );
    levelRowMap.set( 3, levelThree );
    return levelRowMap;
};


/**
 * This function will update the props and absType for selected row, based on absType.
 * @param {String} absType - Abstract type of the selected row.
 * @param {Object} row - Selected row.
 */
let _updateSelectedInlineRow = ( absType, row ) =>  {
    row.absType = absType;
    let propUiValue;
    switch ( absType ) {
        case pca0Constants.CFG_OBJECT_TYPES.ABS_LITERAL_VALUE_FAMILY:
            // For Cfg0AbsLiteralValueFamily cfg0ValueDataType, is set to String and is editable.
            // props optional, freeform and multiselect are set to false, and are editable by default
            propUiValue = _localeTextBundle[pca0Constants.FAMILY_VALUE_TYPES[3]];
            _updatePropertyValue( row.props.cfg0ValueDataType, pca0Constants.FAMILY_VALUE_TYPES[3], propUiValue );
            _updateBooleanPropsForSelectedRow( row.props, [ _optionalProp, _freeformProp, _multiSelectProp ], false );
            _togglePropertyEditability( row.props, [ _valueDataTypeProp, _optionalProp, _freeformProp, _multiSelectProp ], true );
            break;
        case pca0Constants.CFG_OBJECT_TYPES.ABS_SUMMARY_OPTION_FAMILY:
            // For Cfg0AbsSummaryOptionFamily cfg0ValueDataType, is set to String and is not editable.
            // props optional, freeform and multiselect are set to true, false, true respectively, and are editable by default.
            propUiValue = _localeTextBundle[pca0Constants.FAMILY_VALUE_TYPES[3]];
            _updatePropertyValue( row.props.cfg0ValueDataType, pca0Constants.FAMILY_VALUE_TYPES[3], propUiValue );
            _togglePropertyEditability( row.props, [ _valueDataTypeProp ], false );
            _updateBooleanPropsForSelectedRow( row.props, [ _freeformProp ], false );
            _updateBooleanPropsForSelectedRow( row.props, [ _optionalProp, _multiSelectProp ], true );
            _togglePropertyEditability( row.props, [ _optionalProp, _freeformProp, _multiSelectProp ], true );
            break;
        case pca0Constants.CFG_OBJECT_TYPES.ABS_PACKAGE_OPTION_FAMILY:
            // For Cfg0AbsPackageOptionFamily cfg0ValueDataType, is set to String and is not editable.
            // props optional, freeform and multiselect are set to true, false, false respectively, and are editable by default.
            propUiValue = _localeTextBundle[pca0Constants.FAMILY_VALUE_TYPES[3]];
            _updatePropertyValue( row.props.cfg0ValueDataType, pca0Constants.FAMILY_VALUE_TYPES[3], propUiValue );
            _togglePropertyEditability( row.props, [ _valueDataTypeProp ], false );
            _updateBooleanPropsForSelectedRow( row.props, [ _optionalProp ], true );
            _updateBooleanPropsForSelectedRow( row.props, [ _freeformProp, _multiSelectProp ], false );
            _togglePropertyEditability( row.props, [ _optionalProp, _freeformProp, _multiSelectProp ], true );
            break;
        case pca0Constants.CFG_OBJECT_TYPES.ABS_FEATURE_FAMILY:
            // For Cfg0AbsFeatureFamily cfg0ValueDataType, is set to String and is not editable.
            // props optional, freeform and multiselect are set to false by default.
            propUiValue = _localeTextBundle[pca0Constants.FAMILY_VALUE_TYPES[3]];
            _updatePropertyValue( row.props.cfg0ValueDataType, pca0Constants.FAMILY_VALUE_TYPES[3], propUiValue );
            _updateBooleanPropsForSelectedRow( row.props, [ _optionalProp, _freeformProp, _multiSelectProp ], false );
            _togglePropertyEditability( row.props, [ _optionalProp, _multiSelectProp ], true );
            _togglePropertyEditability( row.props, [ _valueDataTypeProp, _freeformProp ], false );
            break;
        case pca0Constants.CFG_OBJECT_TYPES.ABS_FEATURE:
            // For Cfg0AbsFeature props free-form and multiselect are set to False, and optional set to True
            // and are not editable by default.
            _updateBooleanPropsForSelectedRow( row.props, [ _freeformProp, _multiSelectProp ], false );
            _updateBooleanPropsForSelectedRow( row.props, [ _optionalProp ], true );
            _togglePropertyEditability( row.props, [ _optionalProp, _multiSelectProp, _freeformProp ], false );
            break;
        case pca0Constants.CFG_OBJECT_TYPES.ABS_PRODUCT_MODEL_FAMILY:
            // For Cfg0AbsProductModelFamily props optional, multi select are set to false,
            // and optional, multiselect, feature data type props are not editable by default.
            _updateBooleanPropsForSelectedRow( row.props, [ _optionalProp, _multiSelectProp ], false );
            _togglePropertyEditability( row.props, [ _optionalProp, _multiSelectProp, _valueDataTypeProp ], false );
            break;
        case pca0Constants.CFG_OBJECT_TYPES.ABS_SUMMARY_MODEL_FAMILY:
        case pca0Constants.CFG_OBJECT_TYPES.ABS_PRODUCT_LINE_FAMILY:
            // For Cfg0AbsSummaryModelFamily and Cfg0AbsProductLineFamily props optional, multi select are set to true, and are editable by default.
            // and feature data type prop is not editable by default.
            _updateBooleanPropsForSelectedRow( row.props, [ _optionalProp, _multiSelectProp ], true );
            _togglePropertyEditability( row.props, [ _optionalProp, _multiSelectProp ], true );
            _togglePropertyEditability( row.props, [ _valueDataTypeProp ], false );
            break;
        default:
    }
};

/**
 * This function will set the Boolean props to true or false based on valueToSet.
 * @param {Object} props - Selected row props object.
 * @param {String} propsNameArray - property names to be updated.
 * @param {Boolean} valueToSet (true/false) - Boolean value to be set on property.
 */
let _updateBooleanPropsForSelectedRow = ( props, propsNameArray, valueToSet ) => {
    const trueString = _localeTextBundle.true;
    const falseString = _localeTextBundle.false;
    propsNameArray.forEach( propName => {
        if( valueToSet ) {
            props[propName].dbValue = true;
            props[propName].dbValues = [ '1' ];
            props[propName].uiValue = trueString;
            props[propName].uiValues = [ trueString ];
        } else {
            props[propName].dbValue = false;
            props[propName].dbValues = [ '0' ];
            props[propName].uiValue = falseString;
            props[propName].uiValues = [ falseString ];
        }
    } );
};

/**
 * This function will update cfg0ValueDataType from props based on dataTypeValue
 * @param {valueDataTypeProperty} valueDataTypeProperty - cfg0ValueDataType property object
 * @param {String} dbValue - valueDataTypeProperty dbValue to be set
 * @param {String} uiValue - valueDataTypeProperty uiValue to be set
 */
let _updatePropertyValue = ( valueDataTypeProperty, dbValue, uiValue ) => {
    valueDataTypeProperty.dbValue = dbValue;
    valueDataTypeProperty.dbValues = [ dbValue ];
    valueDataTypeProperty.uiValue = uiValue;
    valueDataTypeProperty.uiValues = [ uiValue ];
};

/**
 * This function will update isEnabled values for given properties in propsNameArray from props object
 * @param {Object} props - selected row props object
 * @param {String} propsNameArray - property names array to be updated
 * @param {Boolean} toEnableOrDisable (true/false) - Boolean value to be set on isEnabled
 */
let _togglePropertyEditability = ( props, propsNameArray, toEnableOrDisable ) => {
    // This will toggle a property state to editable or non editable
    propsNameArray.forEach( propName => {
        if ( props[propName] ) {
            props[propName].isEnabled = toEnableOrDisable;
        }
    } );
};

/**
 * This function will check if Package feature authoring allowed or not
 * @param {Object} selectedObject - vmo of the selected object
 * @returns {Boolean} - Returns True is allowed, else False
 */
let _isPackageFeatureAuthAllowed = ( selectedObject ) =>  {
    return selectedObject.modelType?.typeHierarchyArray.includes( pca0Constants.CFG_OBJECT_TYPES.ABS_PACKAGE_OPTION_FAMILY )
    || selectedObject.modelType?.typeHierarchyArray.includes( pca0Constants.CFG_OBJECT_TYPES.ABS_PACKAGE_OPTION_VALUE )
    || selectedObject.absType === pca0Constants.CFG_OBJECT_TYPES.ABS_PACKAGE_OPTION_FAMILY || selectedObject.absType === pca0Constants.CFG_OBJECT_TYPES.ABS_PACKAGE_OPTION_VALUE
    || selectedObject.type === pca0Constants.CFG_OBJECT_TYPES.PACKAGE_OPTION_VALUE;
};

/**
 * This function will check if Summary feature authoring allowed or not
 * @param {Object} selectedObject - vmo of the selected object
 * @returns {Boolean} - Returns True is allowed, else False
 */
let _isSummaryFeatureAuthAllowed = ( selectedObject ) =>  {
    return selectedObject.modelType?.typeHierarchyArray.includes( pca0Constants.CFG_OBJECT_TYPES.ABS_SUMMARY_OPTION_FAMILY )
    || selectedObject.modelType?.typeHierarchyArray.includes( pca0Constants.CFG_OBJECT_TYPES.ABS_SUMMARY_OPTION_VALUE )
    || selectedObject.absType === pca0Constants.CFG_OBJECT_TYPES.ABS_SUMMARY_OPTION_FAMILY || selectedObject.absType === pca0Constants.CFG_OBJECT_TYPES.ABS_SUMMARY_OPTION_VALUE
    || selectedObject.type === pca0Constants.CFG_OBJECT_TYPES.SUMMARY_OPTION_VALUE;
};

/**
 * This function will check if product model authoring allowed or not
 * @param {Object} selectedObject - vmo of the selected object
 * @returns {Boolean} - Returns True is allowed, else False
 */
let _isProductModelAuthAllowed = ( selectedObject ) =>  {
    const validTypes = [ pca0Constants.CFG_OBJECT_TYPES.ABS_PRODUCT_MODEL_FAMILY, pca0Constants.CFG_OBJECT_TYPES.TYPE_PRODUCT_MODEL ];
    return selectedObject.absType === pca0Constants.CFG_OBJECT_TYPES.ABS_PRODUCT_MODEL_FAMILY || selectedObject.absType === pca0Constants.CFG_OBJECT_TYPES.TYPE_PRODUCT_MODEL
    || selectedObject.modelType && _.intersection( selectedObject.modelType.typeHierarchyArray, validTypes ).length > 0;
};

/**
 * This function will check if summary model authoring allowed or not
 * @param {Object} selectedObject - vmo of the selected object
 * @returns {Boolean} - Returns True is allowed, else False
 */
let _isSummaryModelAuthAllowed = ( selectedObject ) =>  {
    const validTypes = [ pca0Constants.CFG_OBJECT_TYPES.ABS_SUMMARY_MODEL_FAMILY, pca0Constants.CFG_OBJECT_TYPES.ABS_SUMMARY_MODEL ];
    return selectedObject.absType === pca0Constants.CFG_OBJECT_TYPES.ABS_SUMMARY_MODEL_FAMILY || selectedObject.absType === pca0Constants.CFG_OBJECT_TYPES.ABS_SUMMARY_MODEL
    || selectedObject.modelType && _.intersection( selectedObject.modelType.typeHierarchyArray, validTypes ).length > 0;
};

/**
 * This function will check if Standalone feature authoring allowed or not
 * @param {Object} selectedObject - vmo of the selected object
 * @returns {Boolean} - Returns True is allowed, else False
 */
let _isStandaloneFeatureAuthAllowed = ( selectedObject ) => {
    return selectedObject.modelType?.typeHierarchyArray.includes( pca0Constants.CFG_OBJECT_TYPES.ABS_FEATURE_FAMILY )
    || selectedObject.modelType?.typeHierarchyArray.includes( pca0Constants.CFG_OBJECT_TYPES.ABS_FEATURE )
    || selectedObject.absType === pca0Constants.CFG_OBJECT_TYPES.ABS_FEATURE || selectedObject.absType === pca0Constants.CFG_OBJECT_TYPES.ABS_FEATURE_FAMILY
    || selectedObject.type === pca0Constants.CFG_OBJECT_TYPES.FEATURE;
};

/**
 * Update the cfg0ValueDataType for inlineRow.
 * @param {Object} row - inlineRow for which the cfg0ValueDataType LOV value is to be updated.
 * @param {String} propDbValue - Property db value to be updated with this value.
 * @param {String} propUiValue - Property ui value to be updated with this value.
 */
let _updateValueDataTypeLOVValue = ( row, propDbValue, propUiValue ) => {
    row.serverVMO.props.cfg0ValueDataType.dbValue = propDbValue;
    row.serverVMO.props.cfg0ValueDataType.dbValues = [ propDbValue ];
    row.serverVMO.props.cfg0ValueDataType.uiValue = propUiValue;
    row.serverVMO.props.cfg0ValueDataType.uiValues = [ propUiValue ];
    row.serverVMO.props.cfg0ValueDataType.displayValues = [ propUiValue ];
    row.serverVMO.props.cfg0ValueDataType.value = propDbValue;
    row.serverVMO.props.cfg0ValueDataType.isEditable = true;
    row.serverVMO.props.cfg0ValueDataType.isModifiable = true;
    // Setting property type code for cfg0valueDataType
    row.serverVMO.props.cfg0ValueDataType.type = _valueDataTypeCode( propDbValue );
    if ( row.serverVMO.props.cfg0ValueDataType.displayValsModel ) {
        delete row.serverVMO.props.cfg0ValueDataType.displayValsModel;
    }
};

let _valueDataTypeCode = ( propDbValue ) => {
    let typeCode;
    if( propDbValue === pca0Constants.FAMILY_VALUE_TYPES[0] ) {
        typeCode = 5;
    }
    if( propDbValue === pca0Constants.FAMILY_VALUE_TYPES[1] ) {
        typeCode = 3;
    }
    if( propDbValue === pca0Constants.FAMILY_VALUE_TYPES[2] ) {
        typeCode = 2;
    }
    if( propDbValue === pca0Constants.FAMILY_VALUE_TYPES[3] ) {
        typeCode = 8;
    }
    if( propDbValue === pca0Constants.FAMILY_VALUE_TYPES[4] ) {
        typeCode = 8;
    }
    return typeCode;
};

/**
 * Updates the dirty properties of existing edited VMO object into new VMO object provided existing object property is dirty
 * @param {Object} newVmo - an object of which properties to merge using existing VMO properties
 * @param {String} editingVmo - an object of which property to merge into new VMO object
 */
const _mergeDirtyPropsToNewVMO = ( newVmo, editingVmo ) => {
    // iterate over editingVmo to identify its dirty properties
    for( const key of Object.keys( editingVmo.props ) ) {
        let existingVMOProp = editingVmo.props[ key ];
        if( existingVMOProp ) {
            let newVMOprop = newVmo.props[ existingVMOProp.propertyName ];
            if( newVMOprop ) {
                // if property of editedVmo is already dirty then update same values in newVmo
                if( existingVMOProp.dirty ) {
                    _.merge( newVMOprop, existingVMOProp );
                }
                // This check is required for inline authoring in reuse mode
                // Both the 'object_name','cfg0ObjectId' properties are of the LOV type in reuse mode, so hasLov
                // property made true for 'object_name', 'cfg0ObjectId' properties in new Vmo
                const propertyName = newVMOprop.propertyName;
                if( ( propertyName === _objectNameProp || propertyName === _objectIdProp ) &&
                _.get( editingVmo, `props.${propertyName}.hasLov` ) === true ) {
                    newVmo.props[ propertyName ].hasLov = true;
                    if( newVmo.props[ propertyName ].type === 'DATE' ) {
                        newVmo.props[ propertyName ].hasLov = false;
                    }
                }
            }
        }
    }
    delete editingVmo.props;
    // Assigning updated props to old vmo as we are updating treeDataProvider with old vmo
    editingVmo.props = newVmo.props;
    editingVmo.type = newVmo.type;
};

/**
 * Adds an element next to its parent in the viewModelCollection based on the provided UID.
 * @param {Object} viewModelCollection - The collection of view model objects.
 * @param {String} uid - The UID of the row that to reorder.
 * @param {Array} loadedVMOs - The array of loaded view model objects.
 */
let _addElementNextToParent = ( viewModelCollection, uid, loadedVMOs ) => {
    let inlineRowVMOIndex = viewModelCollection.findViewModelObjectById( uid );
    let inlineRowVMO = viewModelCollection.getViewModelObject( inlineRowVMOIndex );
    let parentInlineRowIndex = viewModelCollection.findViewModelObjectById( inlineRowVMO.parentUID );
    const element = loadedVMOs.splice( inlineRowVMOIndex, 1 )[0];
    loadedVMOs.splice( parentInlineRowIndex + 1, 0, element );
};

/**
 * populates the applicable abstract Family object type for inline authoring based on server-configured availability.
 *
 * Makes a findDisplayableSubBusinessObjectsWithDisplayNames for Cfg0AbsFamily.
 * The result is evaluated with the following priority (first match wins):
 *   1) ABS_LITERAL_VALUE_FAMILY (returns immediately if present)
 *   2) ABS_FEATURE_FAMILY (Dynamic family)
 *   3) ABS_SUMMARY_OPTION_FAMILY
 *   4) ABS_PACKAGE_OPTION_FAMILY
 * If none are available, a error is shown and the function returns null.
 *
 * @returns {String} The selected abstract family type constant or null when none found.
 */
const _getFamilyAbstractObjectType = async() => {
    const {
        ABS_LITERAL_VALUE_FAMILY, ABS_FEATURE_FAMILY, ABS_SUMMARY_OPTION_FAMILY, ABS_PACKAGE_OPTION_FAMILY
    } = pca0Constants.CFG_OBJECT_TYPES;

    const { boType, exclusionList } = pcaObjectTypeLOVComponentService.getInputForApplicableFamilyTypes();
    const soaInput = {
        input: [ {
            boTypeName: boType,
            exclusionBOTypeNames: exclusionList
        } ]
    };
    const response = await soaSvc.postUnchecked( 'Core-2010-04-DataManagement', 'findDisplayableSubBusinessObjectsWithDisplayNames', soaInput );

    let hasDynamic = false;
    let hasSummary = false;
    let hasPackage = false;

    const displayableTypes = response.output && response.output[0] && response.output[0].displayableBOTypeNames;

    for( const type of displayableTypes ) {
        const parents = type.boParents;

        if( parents.includes( ABS_LITERAL_VALUE_FAMILY ) ) { return ABS_LITERAL_VALUE_FAMILY; } // If Literal type found, return immediately
        if( parents.includes( ABS_FEATURE_FAMILY ) ) {
            hasDynamic = true; continue;
        }
        if( parents.includes( ABS_SUMMARY_OPTION_FAMILY ) ) {
            hasSummary = true; continue;
        }
        if( parents.includes( ABS_PACKAGE_OPTION_FAMILY ) ) { hasPackage = true; }
    }

    if( hasDynamic ) { return ABS_FEATURE_FAMILY; }
    if( hasSummary ) { return ABS_SUMMARY_OPTION_FAMILY; }
    if( hasPackage ) { return ABS_PACKAGE_OPTION_FAMILY; }

    // Show error message if no family abstract type is not found.
    messagingService.showError( _.get( _localeTextBundle, 'Pca0NoFamilyTypeFound', null ) );
    return null;
};

/**
 *   Export APIs section starts
 */
let exports = {};

/**
 * Add inline row to parent node
 * @param {Object} parentNode - parent node object under which inline row to be added
 * @param {Object} childNode - inline row view model object to be added under parent node
 * @param {Object} childNodeIndex - index under parent node at which child node to be added
 */
export const addChildToParentsChildrenArray = ( parentNode, childNode, childNodeIndex ) => {
    if( parentNode ) {
        if( !parentNode.children || parentNode.children.length === 0 ) {
            parentNode.expanded = true;
            parentNode.isExpanded = true;
            parentNode.children = [];
        }
        childNodeIndex < parentNode.children.length ? parentNode.children.splice( childNodeIndex, 0, childNode ) :
            parentNode.children.push( childNode );
        parentNode.isLeaf = false;
        parentNode.totalChildCount = parentNode.children.length;
    }
};

/**
 * Renders the inline row after creation.
 * @param {Object} targetObjectType - target Object Type
 * @param {Object} absType - Abstract type of the object
 * @param {Object} parentNode - parent Node
 * @param {Object} unsavedRowList - the unsaved Row List
 * @param {Object} newRowCacheMap - the new row CacheMap
 * @param {Object} treeDataProvider - the treeDataProvider
 * @param {String} inlineAuthoringHandlerContext - the context
 * @param {Object} objectTypesCacheMap - the objectTypesCacheMap to be passed into the type LOV component
 * @param {String} gridId - the grid id
 * @param {Object} clientScope - clientScopeURI of the page
 * @returns {Object} - Returns updated unsavedRowList
 */
export let renderInlineRow = function( targetObjectType, absType,  parentNode, unsavedRowList, newRowCacheMap, treeDataProvider, inlineAuthoringHandlerContext, objectTypesCacheMap, gridId, clientScope ) {
    let deferred = awPromiseService.instance.defer();

    let getViewModelForCreateResponse = { ...newRowCacheMap[ targetObjectType ] };

    if( getViewModelForCreateResponse && parentNode ) {
        // Create model object from json string
        getViewModelForCreateResponse.parentNode = parentNode;
        let serverVMO = parsingUtils.parseJsonString( getViewModelForCreateResponse.viewModelObject );

        // Set unique id for each model object
        serverVMO.uid = pca0VCAUtils.instance.getUniqueID();

        // Modify the target VMO type to enable desired ui widget for editable cell
        if( parentNode.props.hasOwnProperty( _valueDataTypeProp ) ) {
            // Intentionally comparing dbValue instead of uiValue to support use case in any locale,
            // As dbValue will remain same even if user changes display value for feature data types.
            if( parentNode.props.cfg0ValueDataType.dbValue === pca0Constants.FAMILY_VALUE_TYPES[ 2 ] ) {
                serverVMO.props.object_name.type = 2;
                if( !_.isUndefined( serverVMO.props.cfg0ObjectId ) ) {
                    serverVMO.props.cfg0ObjectId.type = 2;
                }
            }
            if( parentNode.props.cfg0ValueDataType.dbValue === pca0Constants.FAMILY_VALUE_TYPES[ 0 ] ) {
                serverVMO.props.object_name.type = 5;
                if( !_.isUndefined( serverVMO.props.cfg0ObjectId ) ) {
                    serverVMO.props.cfg0ObjectId.type = 5;
                }
            }
            if( parentNode.props.cfg0ValueDataType.dbValue === pca0Constants.FAMILY_VALUE_TYPES[ 1 ] ) {
                serverVMO.props.object_name.type = 3;
                if( !_.isUndefined( serverVMO.props.cfg0ObjectId ) ) {
                    serverVMO.props.cfg0ObjectId.type = 3;
                }
            }
        }

        // Replace json string with the model object
        getViewModelForCreateResponse.viewModelObject = serverVMO;
        unsavedRowList.push( getViewModelForCreateResponse );

        // Create VMO for inline row
        let vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( serverVMO, 'EDIT' );
        let updatedVMO = viewModelObjectSvc.createViewModelObject( vmo, 'EDIT', null, serverVMO );
        updatedVMO.setEditableStates( true, true, true );
        updatedVMO.absType = absType;
        let configuratorCtx = appCtxService.getCtx( veConstants.CONFIG_CONTEXT_KEY );
        let childVMO = _createViewModelTreeNodeUsingVMO( updatedVMO, parentNode, configuratorCtx.reuseMode );
        if( updatedVMO.absType === pca0Constants.CFG_OBJECT_TYPES.ABS_FEATURE ) {
            // As namespace property value for standalone feature and parent dynamic family is same, update standalone feature namespace property value in VMO while
            // rendering the standalone feature inline row
            _updatePropertyValue( updatedVMO.props.cfg0FamilyNamespace, parentNode.props.cfg0FamilyNamespace.dbValue, parentNode.props.cfg0FamilyNamespace.uiValue );
            let propUiValue = _localeTextBundle[pca0Constants.FAMILY_VALUE_TYPES[4]];
            _updatePropertyValue( updatedVMO.props.cfg0ValueDataType, pca0Constants.FAMILY_VALUE_TYPES[4], propUiValue );
            _updateBooleanPropsForSelectedRow( updatedVMO.props, [ _optionalProp ], true );
            let propsToBeUpdated = [ _optionalProp, _multiSelectProp, _freeformProp, _valueDataTypeProp, _familyNamespaceProp ];
            _togglePropertyEditability( updatedVMO.props, propsToBeUpdated, false );
        }
        // For Cfg0AbsProductModelFamily props 'cfg0IsDiscretionary', 'cfg0IsMultiselect', 'cfg0ValueDataType' are noneditable by default.
        // For Cfg0AbsProductLineFamily props 'cfg0IsDiscretionary', 'cfg0IsMultiselect' are set to true, and 'cfg0ValueDataType' is noneditable by default.
        if( updatedVMO.absType === pca0Constants.CFG_OBJECT_TYPES.ABS_PRODUCT_MODEL_FAMILY || updatedVMO.absType === pca0Constants.CFG_OBJECT_TYPES.ABS_PRODUCT_LINE_FAMILY ) {
            const propsToBeUpdated = updatedVMO.absType === pca0Constants.CFG_OBJECT_TYPES.ABS_PRODUCT_MODEL_FAMILY ?
                [ _optionalProp, _multiSelectProp, _valueDataTypeProp ] : [ _valueDataTypeProp ];
            _togglePropertyEditability( updatedVMO.props, propsToBeUpdated, false );
            if( updatedVMO.absType === pca0Constants.CFG_OBJECT_TYPES.ABS_PRODUCT_LINE_FAMILY ) {
                _updateBooleanPropsForSelectedRow( updatedVMO.props, [ _optionalProp, _multiSelectProp ], true );
            }
        }
        _.merge( childVMO, updatedVMO );

        if( configuratorCtx.reuseMode && clientScope === veConstants.CLIENT_SCOPE_URI.FEATURES ) {
            [ _objectNameProp, _objectIdProp ].forEach( function( propname ) {
                if( childVMO.props[ propname ] ) {
                    childVMO.props[ propname ].hasLov = true;
                    if( childVMO.props[ propname ].type === 'DATE' ) {
                        childVMO.props[ propname ].hasLov = false;
                    }
                }
            } );
        }
        childVMO.serverVMO = serverVMO;
        //add required in the vmo for name column on group, family and feature
        //this required will then be shown in editing mode in the text area when it's empty
        //the requirement to show it generally (not when text area exists aka focused column) is handled via renderer
        childVMO.props.object_name.isRequired = true;
        if( childVMO.props.object_type ) {
            childVMO.props.object_type.objectTypesCachedValues = objectTypesCacheMap[ targetObjectType ];
        }
        childVMO.alternateID = childVMO.uid;
        // Insert VMO into tree
        _insertInlineRow( treeDataProvider, parentNode, childVMO );

        // Set edit handler
        let dataProvider = treeDataProvider;
        editHandlerSvc.setEditHandler( pca0InlineAuthoringEditService, inlineAuthoringHandlerContext );
        editHandlerSvc.setActiveEditHandlerContext( inlineAuthoringHandlerContext );
        let dataSource = _createDataSource( { treeDataProvider: dataProvider } );
        pca0InlineAuthoringEditService.setDataSource( dataSource );

        let currentInlineAuthoringContext = { inlineAuthoringContext: {} };
        currentInlineAuthoringContext.inlineAuthoringContext.isInlineAuthoringMode = true;

        // Update inline authoring mode in ctx
        for( const key of Object.keys( currentInlineAuthoringContext ) ) {
            configuratorCtx[ key ] = currentInlineAuthoringContext[ key ];
        }
        appCtxService.updatePartialCtx( veConstants.CONFIG_CONTEXT_KEY, configuratorCtx );

        // Define callback for save/discard actions
        let callBackObj = {
            inlineAuthoringEditHandler: inlineAuthoringHandlerContext,
            cancelEdits: function() {
                return cancelEdits();
            },
            saveEdits: function() {
                return saveEdits( callBackObj.inlineAuthoringEditHandler );
            }
        };
        // Scroll to new row
        let scrollEventData = {
            gridId: gridId,
            rowUids: [ childVMO.uid, childVMO.parentUID ]
        };
        eventBus.publish( 'plTable.scrollToRow', scrollEventData ); //keep scrolling here LCS-763434

        //Select the newly added child
        treeDataProvider.selectionModel.setSelection( childVMO );

        pca0InlineAuthoringEditService.startEdit( callBackObj );
        deferred.resolve( unsavedRowList );
    }

    return deferred.promise;
};

/**
 * Cancels the edits by discarding all the unsaved rows and removes the edit handler
 */
export let cancelEdits = function() {
    eventBus.publish( 'pca0InlineAuthoringHandler.discardUnsavedAndResetInlineDataCache' );
};

/**
 * Saves the edits by triggering the SOA call
 * @param {String} inlineAuthoringHandlerContext - edit handler name
 */
export let saveEdits = function( inlineAuthoringHandlerContext ) {
    exports.removeEditHandler( inlineAuthoringHandlerContext );
    appCtxService.updateCtx( 'editInProgress', false );
    // invoke viewmodelaction saveInlineRows
    eventBus.publish( 'Pca0InlineAuthoring.createVariabilityObject' );
};

/**
 * Returns list of properties visible in the table.
 * @param {Object} treeDataProvider - The Tree Data Provider
 * @returns {Object} - Returns the list of properties
 */
export let populateVisiblePropertyList = function( treeDataProvider ) {
    let propertyNames = [ 'object_string' ];
    // Iterate over column config properties and collect visible properties into PropertyNames list.
    _.forEach( treeDataProvider.columnConfig.columns, function( column ) {
        if( column.hiddenFlag !== undefined && column.hiddenFlag === false ) {
            propertyNames.push( column.propertyName );
        }
    } );
    propertyNames = _.uniq( propertyNames );
    return propertyNames;
};

/**
 * Resets inline row cache
 * @returns {Object} empty object to be set for inline row cache
 */
export let resetInlineDataCache = function() {
    // reset inline authoring handler status
    pca0InlineAuthoringEditService.notifySaveStateChanged( 'reset' );

    // set inlineauthoring mode as false
    let currentInlineAuthoringContext = { inlineAuthoringContext: {} };
    currentInlineAuthoringContext.inlineAuthoringContext.isInlineAuthoringMode = false;

    // update inline authoring mode in ctx
    let currentContext = appCtxService.getCtx( veConstants.CONFIG_CONTEXT_KEY );
    for( const key of Object.keys( currentInlineAuthoringContext ) ) {
        currentContext[ key ] = currentInlineAuthoringContext[ key ];
    }
    appCtxService.updatePartialCtx( veConstants.CONFIG_CONTEXT_KEY, currentContext );

    // reset unsavedRows list info in viewmodel
    return [];
};

/**
 * Updates inline row cache after partial success, keeps around only the still unsaved rows and also
 * returns the saved ones for further processing
 * @param {Object} unsavedRows - unsaved Rows
 * @param {Object} serviceData - service Data
 * @param {Object} treeDataProvider - treeDataProvider
 * @returns {Object} object containing the 2 sub arrays of saved and unsaved rows (one will stay, one will get processed)
 */
export let updateUnsavedRows = function( unsavedRows, serviceData, treeDataProvider ) {
    let newUnsavedRows = [ ...unsavedRows ];
    let savedRows = [ ...unsavedRows ];

    if( unsavedRows && serviceData && serviceData.partialErrors ) {
        //get the new UnsavedRows array = old minus the rows created
        newUnsavedRows = unsavedRows.filter( function( inlineRow ) {
            return serviceData.partialErrors.some( function( partialError ) {
                let shouldStay = partialError.clientId === undefined || partialError.clientId === inlineRow.viewModelObject.uid;
                //you also need to include the hierarchy under a potentially unsavable row
                //since you don't get in the response what rows have been saved, just the ones that have not and
                //the response won't include children, so they would be lost
                if( !shouldStay && inlineRow.parentNode && ( inlineRow.parentNode.uid === partialError.clientId ||
                        inlineRow.parentNode.parentUID && inlineRow.parentNode.parentUID === partialError.clientId ) ) {
                    shouldStay = true;
                }
                // We only want to show failed rows for ERROR/FATAL Level i.e. level = 3 or 4
                // So checking error value level if it is info or warning we will skip showing failed rows.
                // user will get info/warning message popup though.
                if( !partialError.errorValues.some( errorVal => errorVal.level >= 3 ) ) {
                    shouldStay = false;
                }
                if( shouldStay ) {
                    let treeVMO = pca0ConfiguratorExplorerCommonUtils.getInlineRowByUid( treeDataProvider, inlineRow.viewModelObject.uid );
                    let msg = partialError.errorValues[ 0 ].message;
                    treeVMO.partialErrorText = msg;
                    inlineRow.partialErrorText = msg;
                }
                return shouldStay;
            } );
        } );
        savedRows = unsavedRows.filter( x => !newUnsavedRows.includes( x ) );
    }
    let failedUnsavedRows = newUnsavedRows.map( function( row ) {
        return { ...row };
    } );

    // Disable inline authoring mode when there are no unsaved or failed unsaved rows.
    // This will disable Save button implicitly.
    if( newUnsavedRows.length === 0 || failedUnsavedRows.length === 0 ) {
        let contextKey = veConstants.CONFIG_CONTEXT_KEY;
        let clonedCtx = _.cloneDeep( appCtxService.getCtx( contextKey ) );
        clonedCtx.inlineAuthoringContext.isInlineAuthoringMode = false;
        appCtxService.updatePartialCtx( contextKey + '.inlineAuthoringContext.isInlineAuthoringMode', clonedCtx.inlineAuthoringContext.isInlineAuthoringMode );
    }
    return {
        unsavedRows: newUnsavedRows,
        savedRows: savedRows,
        failedUnsavedRows: failedUnsavedRows
    };
};

/**
 * Updates the inlineRow properties in VMO when user selects any value from object_name
 * When we create a new variability in reuse mode, the props are reset to the default values of specific type being authored i.e. Group, Family, or Feature.
 * LOV for Reuse mode
 * @param {Object} eventData - vmo and update value
 * @param {Object} treeDataProvider - Tree data provider
 * @param {Object} widgetPropertyName - Widget property name
 *
 */
export let updateInlineRowVMOPropertiesForReuse = function( eventData, treeDataProvider, widgetPropertyName ) {
    let inlineRow = treeDataProvider.selectedObjects[ 0 ];
    //this is the selection case - make everything read only but the name col
    let existingParentNodeIdx = treeDataProvider.getViewModelCollection().findViewModelObjectById( inlineRow.uid );
    if( existingParentNodeIdx !== -1 ) {
        let row = treeDataProvider.getViewModelCollection().getViewModelObject( existingParentNodeIdx );
        let vmo;
        let newInlineRow;
        const isStandaloneFeature = inlineRow.absType === pca0Constants.CFG_OBJECT_TYPES.ABS_FEATURE;
        // All cases are for reuse mode:
        // CASE 1: The user authors a new row and changes the type, the row should be updated according to selected type. If they try to create a new family,
        //         and not allocate it should be allowed.
        // CASE 2: When the user tries to allocate an available family from lovValues, allocate the family.
        // CASE 3: When the user tries to change the allocated family with a new family, reset the row to default.
        // CASE 4: If the user now wants to change the type after Case 3, allow the type change and do not reset the row.
        //         The row should be updated according to the selected type.
        // CASE 5: If the user now wants to change the name after Case 4, allow updates and don't reset the row."
        //this is the add case - everything stays as it is or reverses to original
        if( !eventData.lovValue.mo && !eventData.lovValue.selected && inlineRow.getDirtyProps().length === 1
                || inlineRow.getDirtyProps().length > 1 &&  ( row.isAllocation || isStandaloneFeature ) ) {
            // Properties to be handled separately for standalone feature
            const propsToTrackForStandaloneFeature = [ _valueDataTypeProp, _freeformProp, _optionalProp, _multiSelectProp, _familyNamespaceProp ];
            const trueUiVal = _localeTextBundle.true;
            const falseUiVal = _localeTextBundle.false;
            for ( let prop in row.serverVMO.props ) {
                if ( row.serverVMO.props.hasOwnProperty( prop ) && !_.isUndefined( row.serverVMO.props[prop].dbValues ) && row.serverVMO.props[prop].dbValues.length !== 0 ) {
                    // As cfg0IsDiscretionary is always set to true for standalone feature. If prop is cfg0IsDiscretionary for inlineRow of Cfg0AbsFeature type update the dbValue to true.
                    // For all other scenarios we reset the prop dbValue values to serverVMO props
                    let dbValues;
                    if( isStandaloneFeature && prop === _optionalProp ) {
                        dbValues = [ '1' ];
                    } else if( isStandaloneFeature && prop === _familyNamespaceProp ) {
                        // As the standalone feature namespace value is same as its parent dynamic value, fetching the cfg0FamilyNamespace dbValue of the prop from standalone feature row props
                        dbValues = row.props[prop].dbValues;
                    } else {
                        dbValues = row.serverVMO.props[prop].dbValues;
                    }
                    // All the properties of serverVMO are default but the allocation may have changed the value of valueDataType, so adding special case for valueDataType
                    // And updating the value to default value.
                    // Special case for standalone feature.
                    // 1. If the inlineRow is of type Cfg0AbsFeature and the propsToTrackForStandaloneFeature includes the property being updated, maintain the properties
                    //    as non-editable.
                    // 2. For standalone features, the default values for 'cfg0HasFreeFormValues', 'cfg0IsDiscretionary', 'cfg0IsMultiselect', and 'cfg0ValueDataType'
                    //    are always False, True, False, and Boolean respectively, and are updated accordingly.
                    // 3. For standalone features, the cfg0FamilyNamespace prop value is same as its parent dynamic family namespace value, we have evaluated the family
                    //    namespace value above and setting the property value on standalone feature here.
                    if( isStandaloneFeature && propsToTrackForStandaloneFeature.includes( prop ) ) {
                        if( prop === _valueDataTypeProp ) {
                            row.serverVMO.props[prop].isEnabled = false;
                            const propValBool = _localeTextBundle.Boolean;
                            _updateValueDataTypeLOVValue( row, 'Boolean', propValBool );
                        } else if ( isStandaloneFeature && prop === _familyNamespaceProp ) {
                            row.serverVMO.props[prop].isEnabled = false;
                            row.serverVMO.props[prop].dbValues = dbValues;
                            row.serverVMO.props[prop].uiValues = dbValues;
                        } else {
                            row.serverVMO.props[prop].dbValues = dbValues;
                            row.serverVMO.props[prop].uiValues = Number( dbValues[0] ) ? [ trueUiVal ] : [ falseUiVal ];
                        }
                    } else if( prop === _valueDataTypeProp ) {
                        // Update valueDataType row property to String
                        const propValString = _localeTextBundle.String;
                        _updateValueDataTypeLOVValue( row, 'String', propValString );
                    } else {
                        row.serverVMO.props[prop].dbValues = dbValues;
                    }
                }
            }
            //if we allocate before, we need to go back to the inline state of it
            vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( row.serverVMO, 'EDIT' );
            newInlineRow = viewModelObjectSvc.createViewModelObject( vmo, 'EDIT', null, row.serverVMO );
            newInlineRow.props[ widgetPropertyName ] = row.props[ widgetPropertyName ];
            row.isAllocation = false;
            row.props = newInlineRow.props;
            row.serverUid = vmo.uid;
            if ( vmo.modelType ) {
                row.displayName = _getInlineRowDisplayName( vmo.modelType.parentTypeName );
                _updateSelectedInlineRow( vmo.modelType.parentTypeName, row );
            }
            // Here the row properties editable states are updated. Ignore if the variability authored is standalone feature.
            // As the properties editability state need not to change for standalone feature.
            if( !isStandaloneFeature ) {
                row.setEditableStates( true, true, true );
            }
        } else if ( eventData.lovValue.mo?.uid ) {
            vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( eventData.response.modelObjects[ eventData.lovValue.mo.uid ], 'EDIT' );
            newInlineRow = viewModelObjectSvc.createViewModelObject( vmo, 'EDIT', null, eventData.response.modelObjects[ eventData.lovValue.mo.uid ] );
            row.isAllocation = true;
            // update serverUid property with actual persisted uid of object.
            // This will be consumed while preparing createInput for createAndAddObjects2 SOA
            row.serverUid = vmo.uid;
            row.displayName = vmo.props.object_string.dbValue;
            _.forEach( row.props, function( prop ) {
                if( prop.propertyName !== widgetPropertyName ) {
                    if( newInlineRow.props[ prop.propertyName ] ) {
                        _.merge( prop, newInlineRow.props[ prop.propertyName ] );
                    } else {
                        //the others should also move to read only state
                        prop.editable = false;
                        prop.isEditable = false;
                    }
                }
            } );
        }
        // Updating the type icon if the new vmo icon is different
        if( vmo ) {
            if ( row.typeIconURL !== vmo.typeIconURL ) {
                row.iconURL = vmo.typeIconURL;
                row.typeIconURL = vmo.typeIconURL;
            }
            if ( vmo.modelType ) {
                // Updating the absType, it will be used while creating features
                row.absType = vmo.modelType.parentTypeName;
            }
        }
    }

    // When the row have children we remove the children and update the tree data provider.
    // In that case for performance reason we are not updating the tree data provider here.
    if( !inlineRow.children || inlineRow.children.length === 0 ) {
        let viewModelCollection = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
        treeDataProvider.update( viewModelCollection );
    }
};

/**
 * This function populates create object input and the respective parent data
 * @param {Object} unsavedRows - List of all unsaved rows to be saved
 * @param {Object} treeDataProvider - Tree data provider
 * @returns {Array} - List of createInput and respective parent node.
 */
export let populateInlineRows = function( unsavedRows, treeDataProvider ) {
    let bulkCreateInput = [];
    const viewModelObjects = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    let columnConfig = treeDataProvider.columnConfig.columns;
    // Check if the family namespace column is visible. This check is required to handle the case when the family namespace column is visible
    // and the user is authoring a new family. In this case, we need to pass the empty family namespace value to SOA if the user has not explicitly added any value
    // and the "Cfg0DefaultOptionFamilyNamespace" preference is not defined.
    let isFamilyNamespaceColumnVisible = columnConfig.some( column => column.propertyName === _familyNamespaceProp && column.hiddenFlag === false );
    unsavedRows.forEach( ( inlineRow ) => {
        let inputObj = _populateCreateObjectInput( inlineRow, treeDataProvider, isFamilyNamespaceColumnVisible );
        let createInput1 = {
            clientID: inlineRow.viewModelObject.uid,
            childCreateInputs: []
        };
        // Check if object getting reused or getting newly created, accordingly create SOA input.
        viewModelObjects.forEach( ( vmo ) => {
            if( vmo.id === inlineRow.viewModelObject.uid ) {
                if( vmo.isAllocation ) {
                    createInput1.variabilityObject = { uid: vmo.serverUid };
                    createInput1.createIn = {
                        //createIn and variability object are mutually exclusive parameters.
                        //However in soaService.js there is a validation for IcreateInput if boName is empty then it logs an error to console.
                        //To avoid the error on console pass a dummy string (boName) as an input to boName.
                        //If it is not a valid boName then soa framework throws an error about invalid boName
                        boName: vmo.type,
                        propertyNameValues: {},
                        compoundCreateInput: {}
                    };
                } else {
                    createInput1.createIn = inputObj.creInput;
                    createInput1.variabilityObject = undefined;
                }
            }
        } );

        // Check if parent of inline row is another inline row itself
        let isCreateInAdded = false;

        _.forEach( bulkCreateInput, function( bulkInput ) {
            if( bulkInput.parent.uid === inlineRow.parentNode.uid ) {
                bulkInput.createInputs.push( createInput1 );
                isCreateInAdded = true;
            } else {
                _.forEach( bulkInput.createInputs, function( createIn ) {
                    if( createIn.clientID === inlineRow.parentNode.uid ) {
                        createIn.childCreateInputs.push( createInput1 );
                        isCreateInAdded = true;
                    } else {
                        _.forEach( createIn.childCreateInputs, function( childInput ) {
                            if( childInput.clientID === inlineRow.parentNode.uid ) {
                                childInput.childCreateInputs.push( createInput1 );
                                isCreateInAdded = true;
                            }
                        } );
                    }
                } );
            }
        } );
        if( !isCreateInAdded ) {
            let objectsToCreateAndAdd = {
                parent: {},
                createInputs: []
            };
            objectsToCreateAndAdd.parent = inputObj.parentNode;
            objectsToCreateAndAdd.createInputs.push( createInput1 );
            bulkCreateInput.push( objectsToCreateAndAdd );
        }
    } );
    // LCS-919332 - Issue when multiple families with features are added under unassigned group
    // bulkCreateInput created was incorrect while populating the childCreateInputs for unassigned families.
    // The parent being context for unassigned families, the input structure created was like multiple groups created under context.
    // Now we are keeping parent as UNASSIGNED_GROUP_UID, and replacing the parent once the bulkCreateInput is finalized.
    // The input should be in line with input when we create multiple families under group.

    //    Correct bulkCreateInput for Unassigned Families
    //    [
    //        {
    //            "parent": {},
    //            "createInputs": [ Family1, Family2 ]
    //        }
    //    ]

    for( const bulkCreIn of bulkCreateInput ) {
        if ( bulkCreIn.parent.uid === pca0Constants.PSEUDO_GROUPS_UID.UNASSIGNED_GROUP_UID ) {
            bulkCreIn.parent = viewModelObjects[0];
            break;
        }
    }
    return bulkCreateInput;
};

/**
 * Updates the view model collection based on response from createAndAddObjects2 SOA
 * @param {Object} savedRows - successfully saved inline rows for which save action was called for
 * @param {Object} failedUnsavedRows - failed inline rows which need to be aligned
 * @param {Object} treeDataProvider - Tree data provider
 * @param {Object} soaResponse - Response from createAndAddObjects2 SOA
 * @param {Object} selectSavedRows - select Saved Rows flag - false for the unsuccess use case, true for the success one
 * @returns {Object} - Returns the list of newly authored rows which needs to be selected
 */
export let postSaveHandler = function( savedRows, failedUnsavedRows, treeDataProvider, soaResponse, selectSavedRows ) {
    let viewModelCollection = treeDataProvider.getViewModelCollection();
    let loadedVMOs = viewModelCollection.getLoadedViewModelObjects();
    let processingRows = [ ...savedRows ];
    // Combine saved and failed unsaved rows.
    // So we can process them together.
    if( failedUnsavedRows ) {
        processingRows = processingRows.concat( failedUnsavedRows );
    }
    // extract VMO uid list to store position of existing loaded viewModelCollection.
    const existingVMOUidList = loadedVMOs.map( obj => obj.uid );

    // create Level based sorted map of processingRows rows.
    let levelWiseRowMap = _levelBasedSort( processingRows, treeDataProvider, existingVMOUidList );
    let selectionMOList = [];

    //Checking boolean families
    let familiesToSave = levelWiseRowMap.get( 2 );
    let booleanFamiliesUid = [];
    let booleanFamiliesVMO = [];
    const variabilityNodes = pca0CommonUtils.getVariabilityNodes( soaResponse );
    familiesToSave.forEach( function( family ) {
        let existingInlineRowIdx = viewModelCollection.findViewModelObjectById( family.viewModelObject.uid );
        let familyVMO = loadedVMOs[existingInlineRowIdx];
        if( _.get( familyVMO, 'props.cfg0ValueDataType.dbValue' ) === 'Boolean' ) {
            let familyNode = _.find( variabilityNodes, ( node ) => {
                if( node.props.clientID ) { return node.props.clientID[0] === familyVMO.uid; }
                return false;
            } );
            booleanFamiliesUid.push( familyNode.nodeUid );
        }
    } );
    for( let currentLevelNdx = 1; currentLevelNdx <= 3; currentLevelNdx++ ) {
        // process inline row of current level and its siblings
        let currentLevelRows = levelWiseRowMap.get( currentLevelNdx );
        currentLevelRows.forEach( function( inlineRow ) {
            let existingInlineRowIdx = viewModelCollection.findViewModelObjectById( inlineRow.viewModelObject.uid );
            // If the variabilityNode VMO is replaced and required inline row could not be found in viewModelCollection, find the existingInlineRowIdx in existingVMOUidList.
            if( existingInlineRowIdx === -1 ) {
                existingInlineRowIdx = existingVMOUidList.indexOf( inlineRow.viewModelObject.uid );
            }
            if( existingInlineRowIdx !== -1 ) {
                let existingParentNodeIdx = viewModelCollection.findViewModelObjectById( inlineRow.parentNode.uid );
                if( existingParentNodeIdx === -1 ) {
                    existingParentNodeIdx = existingVMOUidList.indexOf( inlineRow.parentNode.uid );
                }
                let parentVMO = viewModelCollection.getViewModelObject( existingParentNodeIdx );
                let unsavedRow;
                if( !_.isUndefined( failedUnsavedRows ) ) {
                    unsavedRow = _.find( failedUnsavedRows, ( row )=> {
                        return row.viewModelObject.uid === inlineRow.viewModelObject.uid;
                    } );
                }

                if( unsavedRow ) {
                    // In case of partial success scenario where parent is saved but child is failed,
                    // child unsaved rows might be still holding previous unsaved parent uid.
                    // We have to Update parent info of such unsaved nodes with updated parent uid.
                    let inlineRowVMO = viewModelCollection.getViewModelObject( existingInlineRowIdx );
                    inlineRowVMO.parentUID = parentVMO.uid;
                    unsavedRow.parentNode.nodeUid = parentVMO.nodeUid;
                    unsavedRow.parentNode.uid = parentVMO.uid;
                    unsavedRow.parentNode.id = parentVMO.id;
                    unsavedRow.parentNode.parentUID = parentVMO.parentUID;
                    unsavedRow.parentNode.alternateID = parentVMO.alternateID;
                }else{
                    // update tree with saved row.
                    let inputNode = _.find( variabilityNodes, { nodeUid: parentVMO.uid } );
                    let childUids = [];
                    if( _.get( inputNode, 'childrenUids' ) ) {
                        childUids = inputNode.childrenUids;
                    }
                    for( let childIdx = 0; childIdx < childUids.length; childIdx++ ) {
                        let childVMOIdx = viewModelCollection.findViewModelObjectById( childUids[ childIdx ] );
                        if( childVMOIdx === -1 ) {
                            // Insert new object replacing the inline rows
                            let levelNdx = parentVMO.levelNdx + 1;
                            soaResponse.resetColumnProperties = true;
                            let childVMOTreeNode = pca0VariabilityTreeDisplayService.createViewModelTreeNode(
                                veConstants.CONFIG_CONTEXT_KEY, childUids[ childIdx ], levelNdx, parentVMO.uid, parentVMO.alternateID, childIdx, soaResponse );

                            // Filtering boolean families
                            let boolNodeUid = _.find( booleanFamiliesUid, ( uid ) => {
                                return uid === childVMOTreeNode.nodeUid;
                            } );
                            if ( !_.isUndefined( boolNodeUid ) ) {
                                booleanFamiliesVMO.push( childVMOTreeNode );
                            }

                            if( !_.isUndefined( childVMOTreeNode.childrenUids ) && childVMOTreeNode.childrenUids.length > 0 ) {
                                childVMOTreeNode.isExpanded = true;
                                childVMOTreeNode.isLeaf = false;
                            } else {
                                childVMOTreeNode.isLeaf = true;
                            }
                            let selObj = cdm.getObject( childVMOTreeNode.uid );
                            //the object won't always exist in cdm map - i.e unassigned families first child
                            if( selObj ) {
                                selObj.alternateID = childVMOTreeNode.alternateID;
                                selectionMOList.push( selObj );
                                //LCS-821334 - While setting the selection the VMO was not populated with model type
                                //For delete command we have the condition  that checking the modeltype, so adding the type into the VMO
                                childVMOTreeNode.modelType = selObj.modelType;
                            }

                            if( _.isUndefined( parentVMO.children ) ) {
                                parentVMO.children = [];
                            }
                            // Make sure the inlineRowVMO being updated in loadedVMO is corrent, if not update the existingInlineRowIdx.
                            // Identify if childUid node is present in soaResponse variabilityNodes, and if available based on the clientID find the new index of existingInlineRow.
                            // Fetch the inlineRowVMO based on the newly computed existingInlineRowIdx, and splice the treeNodeVMO in loadedVMOs.
                            let childUidVarNode = _.find( variabilityNodes, ( varNode ) => varNode.nodeUid === childUids[ childIdx ] );
                            existingInlineRowIdx = viewModelCollection.findViewModelObjectById( childUidVarNode.props.clientID[0] );
                            let inlineRowVMO = viewModelCollection.getViewModelObject( existingInlineRowIdx );
                            // Add the new treeNode to the parentVMO and update view model collection
                            let newIdx = loadedVMOs.indexOf( inlineRowVMO );
                            if( newIdx === -1 ) {
                                newIdx = loadedVMOs.indexOf( parentVMO ) + 1;
                            }
                            loadedVMOs.splice( newIdx, 1, childVMOTreeNode );
                            exports.addChildToParentsChildrenArray( parentVMO, childVMOTreeNode, parentVMO.childNdx );
                            break;
                        }
                    }
                }
            }
        } );
    }

    // This block handles the reordering of failed unsaved rows in the view model collection.If there are failed unsaved rows, it iterates through each row.
    // Finds the index of the failed row and its parent in the view model collection. Removes the failed row from its current position and re-inserts it immediately
    // after its parent. This is done to maintain the order of failed unsaved rows always immediately after their parent.
    if ( failedUnsavedRows && failedUnsavedRows.length > 0 ) {
        failedUnsavedRows.forEach( ( failedUnsavedRow ) => {
            _addElementNextToParent( viewModelCollection, failedUnsavedRow.viewModelObject.uid, loadedVMOs );
        } );
    }

    // For adding boolean feature
    booleanFamiliesVMO.forEach( ( boolFamily ) => {
        let boolFamilyNodeIdx = viewModelCollection.findViewModelObjectById( boolFamily.nodeUid );
        let levelNdx = boolFamily.levelNdx + 1;

        let boolChildVMOTreeNode = pca0VariabilityTreeDisplayService.createViewModelTreeNode(
            veConstants.CONFIG_CONTEXT_KEY, boolFamily.childrenUids[0], levelNdx, boolFamily.uid, boolFamily.alternateID, 0, soaResponse );

        if( !_.isUndefined( boolChildVMOTreeNode.childrenUids ) && boolChildVMOTreeNode.childrenUids.length > 0 ) {
            boolChildVMOTreeNode.isExpanded = true;
            boolChildVMOTreeNode.isLeaf = false;
        } else {
            boolChildVMOTreeNode.isLeaf = true;
        }
        let selObj = cdm.getObject( boolChildVMOTreeNode.uid );
        if( selObj ) {
            selObj.alternateID = boolChildVMOTreeNode.alternateID;
            selectionMOList.push( selObj );
            boolChildVMOTreeNode.modelType = selObj.modelType;
        }
        loadedVMOs.splice( boolFamilyNodeIdx + 1, 0, boolChildVMOTreeNode );
        let parentVMO = viewModelCollection.getViewModelObject( boolFamilyNodeIdx );
        exports.addChildToParentsChildrenArray( parentVMO, boolChildVMOTreeNode, parentVMO.childNdx );
    } );

    if( selectSavedRows ) {
        treeDataProvider.selectionModel.setSelection( selectionMOList );
    }
    treeDataProvider.update( loadedVMOs );
    //remove the inline rows
    exports.removeInlineRowsAfterSave( savedRows, treeDataProvider );
    // Setting the flag to false since the save process is completed.
    // Normally, this should be updated through an action in a symmetrical JSON. but in batch actions, if one action fails, the subsequent actions are not triggered.
    // But in this case, we also have scenarios of partial success where it needs to be reset.
    exports.updateLockInlineAuthStatus( false );
    return selectionMOList;
};

/**
 * Removes the inline rows after save
 * @param {Object} savedRows - the array of rows to remove
 * @param {Object} treeDataProvider - the tree data provider
 */
export let removeInlineRowsAfterSave = function( savedRows, treeDataProvider ) {
    let viewModelCollection = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    //remove the inline rows
    _.forEach( savedRows, function( inlineRow ) {
        let existingInlineRowIdx = treeDataProvider.getViewModelCollection().findViewModelObjectById( inlineRow.viewModelObject.uid );
        if( existingInlineRowIdx !== -1 ) {
            viewModelCollection.splice( existingInlineRowIdx, 1 );
        }

        // Also remove entry from children array of parent node
        let existingParentNodeIdx = treeDataProvider.getViewModelCollection().findViewModelObjectById( inlineRow.parentNode.nodeUid );
        if( existingParentNodeIdx !== -1 ) {
            let parentVMO = treeDataProvider.getViewModelCollection().getViewModelObject( existingParentNodeIdx );
            if( parentVMO.children.length > 0 ) {
                let inlineRowIdxFromChildArray = parentVMO.children.findIndex( obj => obj.uid === inlineRow.viewModelObject.uid );
                if( inlineRowIdxFromChildArray !== -1 ) {
                    parentVMO.children.splice( inlineRowIdxFromChildArray, 1 );
                }
            }
        }
    } );
    treeDataProvider.update( viewModelCollection );
};

/**
 * Returns the new row cache after a server call filled with the necessary info
 * to create further rows of the same type from cache
 * @param {Object} response - the response from server
 * @param {Object} data - the view model data
 * @returns {Object} - Returns new row cache
 */
export let cacheInlineRowFromServerResponse = function( response, data ) {
    let newRowCacheMap = { ...data.newRowCacheMap };
    let targetObjectType = exports.getTypesToInclude( data.eventData );
    if( !response.ServiceData.partialErrors || response.ServiceData.partialErrors.length === 0 ) {
        newRowCacheMap[ targetObjectType ] = response;
    }

    data.newRowCacheMap = newRowCacheMap;
    return newRowCacheMap;
};

/**
 * Removes the unsaved children of a family from unsavedRows array and view model
 *
 * @param {Object} selectedFamily - VMO of the selected family
 * @param {Object} unsavedRows - List of all inline rows for which save action was called for
 * @param {Object} treeDataProvider - Tree data provider
 * @returns {Object} - Returns the updated list of unsavedRows
 */
export let removeUnsavedChildrenAfterLovValueChange = function( selectedFamily, unsavedRows, treeDataProvider ) {
    //remove children
    let newUnsavedRowsResult = _removeUnsavedRows( selectedFamily, unsavedRows, treeDataProvider, true );
    selectedFamily.children = [];
    //save the changed type to unsaved rows, because it keeps the old value preserved in case of cancelling
    let vmoRowToUpdate = newUnsavedRowsResult.unsavedRows.find( function( inlineRow ) {
        return selectedFamily.uid === inlineRow.viewModelObject.uid;
    } );
    let viewModelCollection = treeDataProvider.getViewModelCollection();
    let vmoDPRow = viewModelCollection.getLoadedViewModelObjects().find( function( row ) {
        return selectedFamily.uid === row.uid;
    } );
    vmoDPRow.isLeaf = true;
    if( vmoRowToUpdate && vmoDPRow ) {
        vmoRowToUpdate.viewModelObject.props.cfg0ValueDataType = { ...vmoDPRow.props.cfg0ValueDataType };
    }
    treeDataProvider.update( viewModelCollection.getLoadedViewModelObjects() );
    return newUnsavedRowsResult;
};

/**
 * Reverses the already selected lov upon confirmation of cancelling removal of children action
 * @param {Object} eventData - eventData
 * @param {Object} unsavedRows - List of all inline rows for which save action was called for
 * @param {Object} treeDataProvider - Tree data provider
 * @param {String} widgetPropertyName - widget property name
 */
export let reverseWidgetSelectionChange = function( eventData, unsavedRows, treeDataProvider, widgetPropertyName ) {
    if( eventData.vmo && eventData.vmo.props[ widgetPropertyName ] ) {
        //get the new vmo and set the previous value to it - get it from the unsaved rows
        let vmoRowToReverse = unsavedRows.find( function( inlineRow ) {
            return eventData.vmo.uid === inlineRow.viewModelObject.uid;
        } );

        if( vmoRowToReverse ) {
            let viewModelCollection = treeDataProvider.getViewModelCollection();
            let vmoDPRow = viewModelCollection.getLoadedViewModelObjects().find( function( row ) {
                return eventData.vmo.uid === row.uid;
            } );
            if( vmoDPRow ) {
                if ( widgetPropertyName === _valueDataTypeProp ) {
                    _updateValueDataTypeProperties( vmoDPRow );
                    //reverting the min-max columns widgets
                    updateMinMaxValueTypeBasedOnFamilyDataType( eventData.vmo, treeDataProvider );
                } else {
                    _updateObjectTypeProperties( vmoDPRow );
                }
                //reverting the previousSelectedLovs prop to store current selected value
                vmoDPRow.props[ widgetPropertyName ].previousSelectedLovs[ 1 ] = vmoDPRow.props[ widgetPropertyName ].previousSelectedLovs[ 0 ];
                treeDataProvider.update( viewModelCollection.getLoadedViewModelObjects() );
            }
        }
    }
};

/**
 * Removes the unsaved selection plus all the underlying children from unsavedRows array and view model
 *
 * @param {Object} eventData - Event Data
 * @param {Object} unsavedRows - List of all inline rows for which save action was called for
 * @param {Object} treeDataProvider - Tree data provider
 * @returns {Object} - Returns the updated list of unsavedRows and failed unsaved rows
 */
export let removeUnsavedRow = function( eventData, unsavedRows, treeDataProvider ) {
    if( !eventData || !eventData.row ) {
        return unsavedRows;
    }
    var parentElementUId = eventData.row.parentUID;
    let newUnsavedRowsResult = _removeUnsavedRows( eventData.row, unsavedRows, treeDataProvider, false );
    let newUnsavedRows = newUnsavedRowsResult.unsavedRows;
    let newFailedUnsavedRows = newUnsavedRowsResult.failedUnsavedRows;
    let parentNode = pca0ConfiguratorExplorerCommonUtils.getInlineRowByUid( treeDataProvider, parentElementUId );
    //remove selected row from children of the parent
    _removeChildFromParent( parentNode, eventData.row.uid );
    //set selection back to parent
    treeDataProvider.selectionModel.setSelection( parentNode );
    if( newUnsavedRows.length === 0 ) {
        pca0InlineAuthoringEditService.notifySaveStateChanged( 'reset' );
    }
    let viewModelCollection = treeDataProvider.getViewModelCollection();
    treeDataProvider.update( viewModelCollection.getLoadedViewModelObjects() );
    return {
        unsavedRows: newUnsavedRows,
        failedUnsavedRows: newFailedUnsavedRows
    };
};

/**
 * Removes the unsaved selection plus all the underlying children from unsavedRows array and view model or just the children
 *
 * @param {Object} selectedRow - selected Row
 * @param {Object} unsavedRows - List of all inline rows for which save action was called for
 * @param {Object} treeDataProvider - Tree data provider
 * @param {Boolean} removeChildrenOnly - optional, removes the children but not the selected row passed in
 * @returns {Object} - Returns the updated list of unsavedRows and failed unsaved rows
 */
let _removeUnsavedRows = function( selectedRow, unsavedRows, treeDataProvider, removeChildrenOnly ) {
    let toRemoveRows = [];
    let newUnsavedRows = [ ...unsavedRows ];
    if( selectedRow && unsavedRows ) {
        if( !removeChildrenOnly ) {
            toRemoveRows.push( selectedRow );
        }
        // go through all max 2 layers of children and collect them all
        if( selectedRow.children && selectedRow.children.length > 0 ) {
            _.forEach( selectedRow.children, function( child ) {
                if( child.isEditing && child.isInlineRow ) {
                    toRemoveRows.push( child );
                    if( child.children && child.children.length > 0 ) {
                        _.forEach( child.children, function( childschild ) {
                            if( child.isEditing && child.isInlineRow ) {
                                toRemoveRows.push( childschild );
                            }
                        } );
                    }
                }
            } );
        }
        //get the new UnsavedRows array = old minus the rows to remove
        newUnsavedRows = unsavedRows.filter( function( inlineRow ) {
            return !toRemoveRows.some( function( inlineRowToRemove ) {
                return inlineRowToRemove.uid === inlineRow.viewModelObject.uid;
            } );
        } );

        // remove those rows from the loaded objects as well in the viewModelCollection
        let viewModelCollection = treeDataProvider.getViewModelCollection();
        viewModelCollection.removeLoadedObjects( toRemoveRows );
        treeDataProvider.update( viewModelCollection.getLoadedViewModelObjects() );
        treeDataProvider.setSelectionEnabled( true );
    }
    // LCS-711405 After authoring a new row and deleting it save command not getting disabled
    // Disable inline authoring mode when there are no unsaved rows.
    // This property will govern Pca0SaveEditsTableCommandHandler behavior.
    if( newUnsavedRows.length === 0 ) {
        let contextKey = veConstants.CONFIG_CONTEXT_KEY;
        let clonedCtx = _.cloneDeep( appCtxService.getCtx( contextKey ) );
        clonedCtx.inlineAuthoringContext.isInlineAuthoringMode = false;
        appCtxService.updatePartialCtx( contextKey + '.inlineAuthoringContext.isInlineAuthoringMode', clonedCtx.inlineAuthoringContext.isInlineAuthoringMode );
    }
    //there may be unsaved rows that are not a fail, new ones getting added and removed, so manage the failed ones separately
    let newUnsavedRowsToFilter = [ ...newUnsavedRows ];
    let newFailedUnsavedRows = newUnsavedRowsToFilter.filter( function( inlineRow ) {
        return inlineRow.partialErrorText !== undefined;
    } );

    return {
        unsavedRows: newUnsavedRows,
        failedUnsavedRows: newFailedUnsavedRows
    };
};

/**
 * Removes the saved selection plus all the underlying children from saved array and view model
 * @param {Object} eventData - Event Data
 * @param {Object} treeDataProvider - Tree data provider
 */
export let removeSavedRowAndChildrenFromUi = ( eventData, treeDataProvider ) => {
    if( !eventData || !eventData.row ) {
        return;
    }
    let parentNode = treeDataProvider.topTreeNode.children[ 0 ];
    let viewModelCollection = treeDataProvider.getViewModelCollection();
    // Check if the row to be removed from ui in event data is an array, if not convert it to an array.
    let selectedRows = _.isArray( eventData.row ) ? eventData.row : [ eventData.row ];

    //set selection back to context when removing multiple rows and to parentnode for single row
    //remove selected row/rows from children of the parent
    if( selectedRows.length > 1 ) {
        selectedRows.forEach( selectedRow => {
            let parent = pca0ConfiguratorExplorerCommonUtils.getInlineRowByUid( treeDataProvider, selectedRow.parentUID );
            // LCS-840588 - when heterogenous object is selected, getting parent is undefined
            // As it's already removed from vmo, added parent check
            if ( parent ) {
                _removeChildFromParent( parent, selectedRow.uid );
            }
        } );
    } else {
        parentNode = pca0ConfiguratorExplorerCommonUtils.getInlineRowByUid( treeDataProvider, selectedRows[0].parentUID );
        _removeChildFromParent( parentNode, selectedRows[0].uid );
    }

    // For boolean families, boolean features also needs to be removed from UI.
    selectedRows = selectedRows.reduce( ( acc, row ) => {
        acc.push( row );
        if ( _.get( row, 'props.cfg0ValueDataType.dbValue' ) === 'Boolean' && row.children > 0 ) {
            acc = acc.concat( row.children );
        }
        return acc;
    }, [] );

    //If any removed group have family as children, then move that families to unassigned families
    let familiesToBeMoved = selectedRows.filter( row =>
        row.modelType.typeHierarchyArray.includes( pca0Constants.CFG_OBJECT_TYPES.ABS_FAMILY_GROUP ) && _.get( row, 'children.length' ) > 0
    ).flatMap( row => row.children );
    if ( familiesToBeMoved.length > 0 ) {
        pca0VariabilityExplorerService.postFamilyMoveHandler( treeDataProvider, familiesToBeMoved );
    }

    // remove those rows from the loaded objects as well in the viewModelCollection
    viewModelCollection.removeLoadedObjects( selectedRows );
    treeDataProvider.selectionModel.setSelection( parentNode );
    treeDataProvider.update( viewModelCollection.getLoadedViewModelObjects() );
};

/**
 * Updates the column configuration based on response
 *
 * @param {Object} response - SOA response for getTableViewModelProperties
 * @param {Object} currColumnConfig - Currently applied column configuration
 * @returns {Object} - Returns the updated column configuration
 */
export let updateColumnConfig = function( response, currColumnConfig ) {
    //update the current column config with new cols from response, but never reduce or change
    //because it changes the order, just add the additional cols
    let newColumnConfig = response.output.columnConfig;
    let newCurrColumnConfigCols = [ ...currColumnConfig.columns ];
    _.forEach( newColumnConfig.columns, function( existingColumns, index ) {
        let obj = currColumnConfig.columns.find( o => o.propertyName === existingColumns.propertyName );
        if( !obj ) {
            newCurrColumnConfigCols.splice( index, 0, existingColumns );
        }
    } );
    currColumnConfig.columns = newCurrColumnConfigCols;
    currColumnConfig.typesForArrange = _.union( currColumnConfig.typesForArrange, newColumnConfig.typesForArrange );
    return currColumnConfig;
};

/**
 * The method will pop up the Confirmation for dependent children on Feature data type widget selection to let the user decide to continue or abort.
 * @param {Object} widgetVmo - widget currently having the selection change that triggers the confirmation
 * @param {Object} viewModelProp - view Model Prop
 * @param {String} widgetPropertyName - widget property name
 */
export let confirmationForWidgetSelectionChange = function( widgetVmo, viewModelProp, widgetPropertyName ) {
    if( !widgetVmo || !widgetVmo.children || widgetVmo.children.length === 0 || widgetVmo.absType === pca0Constants.CFG_OBJECT_TYPES.ABS_FAMILY_GROUP
        ||  widgetVmo.modelType && widgetVmo.modelType.typeHierarchyArray.includes( pca0Constants.CFG_OBJECT_TYPES.ABS_FAMILY_GROUP )  ) {
        return;
    }
    let msg = _localeTextBundle.confirmationToRemoveChildrenOnParentDataTypeChange;
    if( widgetPropertyName === _objectTypeProp ) {
        msg = _localeTextBundle.confirmationToRemoveChildrenOnParentObjectTypeChange;
    }
    let cancelString = _localeTextBundle.cancel;
    let proceedString = _localeTextBundle.continue;
    let buttons = [ {
        addClass: 'btn btn-notify',
        text: cancelString,
        onClick: function( $noty ) {
            $noty.close();
            eventBus.publish( 'Pca0VariabilityExplorerTree.reverseWidgetSelectionChange', {
                vmo: widgetVmo,
                viewModelProp: viewModelProp
            } );
        }
    },
    {
        addClass: 'btn btn-notify',
        text: proceedString,
        onClick: function( $noty ) {
            $noty.close();
            eventBus.publish( 'Pca0VariabilityExplorerTree.goAheadWidgetSelectionChange', {
                vmo: widgetVmo,
                widgetPropertyName: widgetPropertyName
            } );
        }
    }
    ];

    if( widgetVmo.props.object_name.dbValue ) {
        messagingService.showWarning( msg.replace( '{0}', widgetVmo.props.object_name.dbValue ), buttons );
    } else {
        messagingService.showWarning( msg.replace( '\"{0}\"', '' ), buttons );
    }
};

/**
 * Returns the parent element based on availability
 * @param {Object} commandContext - commandContext of the element
 * @param {Object} treeDataProvider - Tree data provider
 * @param {Object} targetObjectType - Target object type
 * @returns {Object} - Returns the parent element
 */
export let populateParentElement = function( commandContext, treeDataProvider, targetObjectType ) {
    if( commandContext.searchState && commandContext.searchState.update ) {
        let newSearchState = { ...commandContext.searchState.value };
        newSearchState.unsavedRows = true;
        commandContext.searchState.update( newSearchState );
    }
    // Setting the root node as parent node
    let parentNode = treeDataProvider.topTreeNode.children[ 0 ];
    // Checking if user has selected any row and updating the parent node
    if( !_.isEmpty( _.get( commandContext, 'selectionData.selected' ) ) ) {
        parentNode = commandContext.selectionData.selected[ 0 ];
    } else if( _.get( commandContext, 'selected' ) ) {
        parentNode = commandContext.selected[ 0 ];
    }

    // When adding feature selecting feature or model selecting model, set parent of the selected row as parent node
    let validTypes = [
        pca0Constants.CFG_OBJECT_TYPES.TYPE_REVISION,
        pca0Constants.CFG_OBJECT_TYPES.TYPE_PRODUCT_MODEL,
        pca0Constants.CFG_OBJECT_TYPES.ABS_SUMMARY_MODEL,
        pca0Constants.CFG_OBJECT_TYPES.ABS_PRODUCT_LINE,
        pca0Constants.CFG_OBJECT_TYPES.ABS_PACKAGE_OPTION_VALUE,
        pca0Constants.CFG_OBJECT_TYPES.ABS_SUMMARY_OPTION_VALUE,
        pca0Constants.CFG_OBJECT_TYPES.ABS_FEATURE
    ];
    if ( validTypes.includes( targetObjectType ) ) {
        let typeHierarchyIncludesValidTypes = false;
        // Check if the type hierarchy includes feature,product model or summary model
        if ( parentNode.modelType ) {
            typeHierarchyIncludesValidTypes = _.intersection( parentNode.modelType.typeHierarchyArray, validTypes ).length > 0;
        }
        // Update parent node if the selected row type if feature or model
        if ( validTypes.includes( parentNode.absType ) || typeHierarchyIncludesValidTypes ) {
            parentNode = pca0ConfiguratorExplorerCommonUtils.getInlineRowByUid( treeDataProvider, parentNode.parentUID );
        }
    }

    const validFamilyTypes = [
        pca0Constants.CFG_OBJECT_TYPES.ABS_LITERAL_VALUE_FAMILY,
        pca0Constants.CFG_OBJECT_TYPES.ABS_PACKAGE_OPTION_FAMILY,
        pca0Constants.CFG_OBJECT_TYPES.ABS_SUMMARY_OPTION_FAMILY,
        pca0Constants.CFG_OBJECT_TYPES.ABS_FEATURE_FAMILY
    ];
    const isValidFamilyType = validFamilyTypes.includes( targetObjectType );

    // Setting Unassigned family as parent node when user is adding family directly under the context
    if( isValidFamilyType && _.get( parentNode, 'modelType.typeHierarchyArray', [] ).includes( 'Cfg0ConfContext' ) ) {
        parentNode = pca0ConfiguratorExplorerCommonUtils.getInlineRowByUid( treeDataProvider, pca0Constants.PSEUDO_GROUPS_UID.UNASSIGNED_GROUP_UID );
    }

    // In some corner use cases the context details are not available in the commandContext, in that case
    // we are taking the context information from the table.
    if( parentNode.modelType?.typeHierarchyArray.includes( pca0Constants.CFG_OBJECT_TYPES.CONF_CONTEXT ) && !parentNode.displayName ) {
        parentNode = pca0ConfiguratorExplorerCommonUtils.getInlineRowByUid( treeDataProvider, parentNode.uid );
    }
    return parentNode;
};

/**
 * Removes the edit handler
 * this is important to do in a non inline authoring mode because keeping it around interferes with other areas
 * and it's not obvious it's because of this handler
 * @param {String} inlineAuthoringHandlerContext - the name of the inlineAuthoringHandlerContext
 * @param {Object} searchState - atomic data to update
 */
export let removeEditHandler = function( inlineAuthoringHandlerContext, searchState ) {
    // LCS-835522: searchState atomic data is coming as undefined from caller saveEdits (a call back function to save edits)
    // This code path will get triggered incase we are switching tab during inline authoring with unsaved data.
    // As we are moving out of current tab there won't be any repercussions if searchState is undefined.
    // Hence adding validation on searchState before using it, to avoid exceptions.
    if( searchState ) {
        let newsearchState = searchState.getValue();
        newsearchState.unsavedRows = false;
        searchState.update( newsearchState );
    }

    var editHandler = editHandlerSvc.getEditHandler( inlineAuthoringHandlerContext ); //inlineAuthoringHandlerContext
    if( editHandler ) {
        editHandlerSvc.removeEditHandler( inlineAuthoringHandlerContext );
    }
};

/**
 * Removes the unsaved selection plus all the underlying children from unsavedRows array and view model or just the children
 *
 * @param {Object} unsavedRows - List of all inline rows for which save action was called for
 * @param {Object} treeDataProvider - Tree data provider
 * @returns {Array} - Returns an empty array
 */
export let discardAllUnsavedRows = function( unsavedRows, treeDataProvider ) {
    let newUnsavedRows = [ ...unsavedRows ];
    let viewModelCollection = treeDataProvider.getViewModelCollection();
    let loadedViewModelObjects = viewModelCollection.getLoadedViewModelObjects();
    _.forEach( newUnsavedRows, function( inlineRow ) {
        let existingInlineRowIdx = viewModelCollection.findViewModelObjectById( inlineRow.viewModelObject.uid );
        if( existingInlineRowIdx !== -1 ) {
            loadedViewModelObjects.splice( existingInlineRowIdx, 1 );
        }

        // Also remove entry from children array of parent node
        const existingParentNodeIdx = viewModelCollection.findViewModelObjectById( inlineRow.parentNode.nodeUid );
        if( existingParentNodeIdx !== -1 ) {
            let parentVMO = viewModelCollection.getViewModelObject( existingParentNodeIdx );
            const childrenLength = _.get( parentVMO, 'children.length' );
            if( childrenLength && childrenLength > 0 ) {
                const inlineRowIdxFromChildArray = parentVMO.children.findIndex( obj => obj.uid === inlineRow.viewModelObject.uid );
                if( inlineRowIdxFromChildArray !== -1 ) {
                    parentVMO.children.splice( inlineRowIdxFromChildArray, 1 );
                }
            }
            //If the parent has no more children, set it as leaf
            if( _.get( parentVMO, 'children.length' ) === 0 ) {
                loadedViewModelObjects[existingParentNodeIdx].isLeaf = true;
            }
        }
    } );
    treeDataProvider.update( loadedViewModelObjects );
    treeDataProvider.setSelectionEnabled( true );
    pca0InlineAuthoringEditService.notifySaveStateChanged( 'reset' );

    //LCS-738746 - Save and Remove command enablement issue in Features Tab
    //set isInlineAuthoringMode to false after discarding
    const contextKey = veConstants.CONFIG_CONTEXT_KEY;
    appCtxService.updatePartialCtx( contextKey + '.inlineAuthoringContext.isInlineAuthoringMode', false );

    //set selection back to root
    const rootNodeIndex = 0;
    const parentNode = viewModelCollection.getViewModelObject( rootNodeIndex );
    treeDataProvider.selectionModel.setSelection( parentNode );
    return [];
};

/**
 * Checks if allowed to save, any empty required field triggers a false
 *
 * @param {Object} unsavedRows - List of all inline rows for which save action was called for
 * @param {Object} treeDataProvider - Tree data provider
 * @returns {Boolean} - Returns true if allowed to save false otherwise
 */
export let isAllowedToSave = function( unsavedRows, treeDataProvider ) {
    let ret = true;
    let newUnsavedRows = [ ...unsavedRows ];
    let vmos = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    _.forEach( newUnsavedRows, function( inlineRow ) {
        if( ret ) {
            let inlineRowVmo = pca0ConfiguratorExplorerCommonUtils.getInlineRowByUid( treeDataProvider, inlineRow.viewModelObject.uid );
            if( inlineRowVmo ) {
                _.forEach( inlineRowVmo.props, function( prop ) {
                    if( ret && prop.isEditable && prop.isRequired && ( prop.dbValue === null || prop.dbValue === '' ) ) {
                        prop.isNotAllowedToSave = true;
                        ret = false;
                    }
                } );
            }
        }
    } );
    if( !ret ) {
        treeDataProvider.update( vmos );
    }
    return ret;
};

/**
 * selects the first UnsavedRow
 * @param {Object} unsavedRows - the array of unsaved rows
 * @param {Object} treeDataProvider - the tree data provider
 */
export let selectFirstUnsavedRow = function( unsavedRows, treeDataProvider ) {
    if( !treeDataProvider || !unsavedRows || unsavedRows.length <= 0 ) {
        exports.resetInlineDataCache();
        treeDataProvider.selectionModel.setSelection( [] );
        return;
    }
    let selectionMOList = [];
    // the first visible unsaved row will be the last added, set selection to it
    let uid = unsavedRows[ unsavedRows.length - 1 ].viewModelObject.uid;
    let selObj = pca0ConfiguratorExplorerCommonUtils.getInlineRowByUid( treeDataProvider, uid );
    selObj.alternateID = uid;
    selectionMOList.push( selObj );

    treeDataProvider.selectionModel.setSelection( selectionMOList );
};

/**
 * This method will update the cfg0MaximumValue and cfg0MinimumValue datatype based on Family data type changed from value data type LOV
 *
 * @param {Object} widgetVmo - widget currently having the selection change that triggers the confirmation
 * @param {Object} treeDataProvider - Tree data provider
 */
export let updateMinMaxValueTypeBasedOnFamilyDataType = function( widgetVmo, treeDataProvider ) {
    if( widgetVmo ) {
        let updatePropValMap = {
            newValue: null,
            newDisplayValues: [],
            displayValues: [],
            dbValue: null,
            uiValue: '',
            isEnabled: true,
            type: ''
        };

        let widgetValueDataType = null;
        widgetValueDataType = _.get( widgetVmo, 'props.cfg0ValueDataType.dbValue', null );

        if ( widgetValueDataType ) {
            // When we have widgetVmo valueDataType String or Integer, we update the propertyValueMap type from pca0Constants enumerated types array
            updatePropValMap.type = pca0Constants.FAMILY_VALUE_TYPES.find( enumType => enumType === widgetValueDataType ).toUpperCase();

            // Update all required values in propertyValMap for specific type as required for Floating Point, Date, and Boolean data types
            switch ( widgetValueDataType ) {
                case 'Floating Point':
                    updatePropValMap.type = 'DOUBLE';
                    break;
                case 'Date':
                    for( let propName in widgetVmo.props ) {
                        if( widgetVmo.props.hasOwnProperty( propName ) ) {
                            let prop = widgetVmo.props[ propName ];
                            if( prop.dateApi ) {
                                prop.dateApi.isTimeEnabled = false;
                            }
                        }
                    }
                    break;
                case 'Boolean':
                    updatePropValMap.type = 'STRING';
                    updatePropValMap.isEnabled = false;
                    break;
                default:
                    break;
            }
        }

        _updateMinMaxValueDataType( widgetVmo, updatePropValMap );
        let viewModelCollection = treeDataProvider.getViewModelCollection();
        treeDataProvider.update( viewModelCollection.getLoadedViewModelObjects(), [ widgetVmo ] );
    }
};

/**
 * selects the next UnsavedRow
 * @param {Object} failedUnsavedRows - the array of unsaved rows
 * @param {Object} treeDataProvider - the tree data provider
 */
export let selectNextUnsavedRow = function( failedUnsavedRows, treeDataProvider ) {
    if( !treeDataProvider || !failedUnsavedRows || failedUnsavedRows.length <= 0 ) {
        return;
    }
    //get current selection - if not an unsaved row, got to the first else determine the next
    let curSelection = treeDataProvider.selectionModel.getSelection();
    if( curSelection && curSelection[ 0 ] ) {
        let curUnsavedRowIndex = failedUnsavedRows.findIndex( function( inlineRow ) {
            return curSelection[ 0 ] === inlineRow.viewModelObject.uid;
        } );
        var previousUnsavedRow = failedUnsavedRows[ curUnsavedRowIndex < 1 ? failedUnsavedRows.length - 1 : curUnsavedRowIndex - 1 ];
        let selectionMOList = [];
        if( previousUnsavedRow ) {
            let selObj = pca0ConfiguratorExplorerCommonUtils.getInlineRowByUid( treeDataProvider, previousUnsavedRow.viewModelObject.uid );
            selectionMOList.push( selObj );
            treeDataProvider.selectionModel.setSelection( selectionMOList );
        }
    } else {
        exports.selectFirstUnsavedRow( failedUnsavedRows, treeDataProvider );
    }
};

/**
* This function creates the input for deleteObjects SOA.
* Checks if allocationUid is there or not. (For Features)
* Returns uid if allocationUid is not present. (For Models)
* AllocationUid is there and deleteAction is true, then it will delete both allocationUid and nodeuid. (features - delete action)
* AllocationUid is there and deleteAction is false, then it will delete only allocationUid. (features - remove action)
* @param {Object} rows - vmo of the row/rows
* @param {Boolean} deleteAction - true for Features Tab - delete action
* @returns {Object} - Returns objects with allocation uid if available, else uid
*/
export let getObjectsToDelete = function( rows, deleteAction ) {
    let objectsToDelete = _.isArray( rows ) ? rows : [ rows ];

    // If allocationUid is present, then it is a Group/Family/Feature.
    if ( objectsToDelete[0].allocationUid ) {
        // If boolean family and feature is selected, then we need to remove the boolean feature.
        objectsToDelete.forEach( vmo => {
            if ( _.get( vmo, 'props.cfg0ValueDataType.dbValue' ) === 'Boolean' && vmo.children ) {
                const booleanFeatureUid = vmo.children[0]?.uid;
                if ( booleanFeatureUid ) {
                    objectsToDelete = objectsToDelete.filter( vmo => vmo.uid !== booleanFeatureUid );
                }
            }
        } );

        let allocationObjects = objectsToDelete.map( ( { allocationUid } ) => ( { uid: allocationUid } ) );
        let objectUids = deleteAction ? objectsToDelete.map( ( { nodeUid } ) => ( { uid: nodeUid } ) ) : [];

        return _.union( allocationObjects, objectUids );
    }

    return objectsToDelete;
};

/**
 * This function will create a new property and store the last two selected feature data type LOVs
 * @param {Object} widgetVmo - vmo of the selected row
 * @param {Object} treeDataProvider - the tree data provider
 * @param {String} widgetPropertyName - widget property name
 */
export let updatePreviousSelectedLovType = function( widgetVmo, treeDataProvider, widgetPropertyName ) {
    let viewModelObjects = [ ...treeDataProvider.getViewModelCollection().getLoadedViewModelObjects() ];
    let nodeIndex = treeDataProvider.getViewModelCollection().findViewModelObjectById( widgetVmo.uid );

    // Check if widgetVmo.props[widgetPropertyName] is defined
    let widgetPropName = _.get( widgetVmo, [ 'props', widgetPropertyName ] );
    if ( widgetPropName ) {
        // If the property is undefined, populate the first index as 'String' by default, else move the second index to the first.
        if ( widgetVmo.props[widgetPropertyName].previousSelectedLovs === undefined ) {
            let previousSelectedLovs = {
                uiValue: widgetVmo.props[widgetPropertyName].prevDisplayValues[0],
                dbValue: pca0Constants.FAMILY_VALUE_TYPES[3]
            };
            _.set( widgetVmo.props[widgetPropertyName], 'previousSelectedLovs', [ previousSelectedLovs ] );
        } else {
            widgetVmo.props[widgetPropertyName].previousSelectedLovs[0] = widgetVmo.props[widgetPropertyName].previousSelectedLovs[1];
        }

        // Populate the second index from the current selected LOV
        let latestSelectedLov = {
            uiValue: widgetVmo.props[widgetPropertyName].uiValue,
            dbValue: widgetVmo.props[widgetPropertyName].dbValue
        };
        widgetVmo.props[widgetPropertyName].previousSelectedLovs[1] = latestSelectedLov;
        viewModelObjects[nodeIndex] = widgetVmo;

        // Skip the update of treeDataProvider for object_type prop, for performance reasons.
        if ( widgetPropertyName !== _objectTypeProp ) {
            treeDataProvider.update( viewModelObjects );
        }
    }
};

/**
 * Returns the new row cache after a server call filled with the necessary info to retrieve the object types by the LOV Type component
 * in order to reuse the list of object types retrieved for a specific inline row type (group, family or feature)
 * @param {Object} objectTypesCacheMap - original objectTypesCacheMap
 * @param {String} boTypeName - the type we cache for
 * @param {Object} loadedObjectTypes - the list to reuse,
 * @param {String} uid - the uid of the current obj
 * @param {Object} viewModelCollection -viewModelCollection,
 * @returns {Object} - Returns new row cache
 */
export let cacheLoadedObjectTypes = function( objectTypesCacheMap, boTypeName, loadedObjectTypes, uid, viewModelCollection ) {
    let newCacheMap = { ...objectTypesCacheMap };
    newCacheMap[ boTypeName ] = loadedObjectTypes;
    //also update the current inline row, so ti won't trigger another soa call
    let viewModelObjects = viewModelCollection.getLoadedViewModelObjects();
    let nodeIndex = viewModelCollection.findViewModelObjectById( uid );
    if( viewModelObjects[ nodeIndex ] ) {
        viewModelObjects[ nodeIndex ].props.object_type.objectTypesCachedValues = loadedObjectTypes;
    }

    return newCacheMap;
};

/**
 * LCS-757077 - BASH_Fall22:Issues with expand icon Issue-1
 * This function will remove the loading Status icon while authoring for cached data
 * Adding new function instead of doing in the same renderInlineRow function because it can fail due to timing issue
 * @param {String} treeDataProvider - tree data provider
 * @param {Object} parentNode -Parent node,
 */
export let resetLoadingStatus = function( treeDataProvider, parentNode ) {
    let viewModelObjects = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    let expectedInlineRowIdx = viewModelObjects.indexOf( parentNode );
    if( viewModelObjects[ expectedInlineRowIdx ].isCached === true && viewModelObjects[ expectedInlineRowIdx ].children ) {
        viewModelObjects[ expectedInlineRowIdx ].loadingStatus = false;
    }
    treeDataProvider.update( viewModelObjects );
};

/**
 * This function returns the type of object based on eventData provided
 * @param {Object} eventData -Event data
 * @returns {String} - Returns the type
 */
export let getTypesToInclude = function( eventData ) {
    if( eventData.targetObjectType ) {
        return eventData.targetObjectType;
    }
    return eventData.selectedObjects[ 0 ].propInternalValue;
};

/**
 * This function will sort the rows by type
 * @param {Object} rows - selected rows
 * @returns {Object} - sorted rows
 */
export const sortRowsByLevel = function( rows ) {
    const levelZero = [];
    const levelOne = [];
    const levelTwo = [];

    rows.forEach( row => {
        switch ( row.modelType.parentTypeName ) {
            case pca0Constants.CFG_OBJECT_TYPES.TYPE_PRODUCT_MODEL:
            case pca0Constants.CFG_OBJECT_TYPES.ABS_SUMMARY_MODEL:
            case pca0Constants.CFG_OBJECT_TYPES.ABS_PRODUCT_LINE:
            case pca0Constants.CFG_OBJECT_TYPES.TYPE_REVISION:
            case pca0Constants.CFG_OBJECT_TYPES.ABS_PACKAGE_OPTION_VALUE:
            case pca0Constants.CFG_OBJECT_TYPES.ABS_SUMMARY_OPTION_VALUE:
            case pca0Constants.CFG_OBJECT_TYPES.ABS_FEATURE:
                levelZero.push( row );
                break;
            case pca0Constants.CFG_OBJECT_TYPES.ABS_SUMMARY_MODEL_FAMILY:
            case pca0Constants.CFG_OBJECT_TYPES.ABS_PRODUCT_MODEL_FAMILY:
            case pca0Constants.CFG_OBJECT_TYPES.ABS_PRODUCT_LINE_FAMILY:
            case pca0Constants.CFG_OBJECT_TYPES.ABS_LITERAL_VALUE_FAMILY:
            case pca0Constants.CFG_OBJECT_TYPES.ABS_PACKAGE_OPTION_FAMILY:
            case pca0Constants.CFG_OBJECT_TYPES.ABS_SUMMARY_OPTION_FAMILY:
            case pca0Constants.CFG_OBJECT_TYPES.ABS_FEATURE_FAMILY:
                levelOne.push( row );
                break;
            case pca0Constants.CFG_OBJECT_TYPES.ABS_FAMILY_GROUP:
                levelTwo.push( row );
                break;
        }
    } );

    return [ ...levelZero, ...levelOne, ...levelTwo ];
};

/**
 * This function will clear the NewRowCacheMap entirely
 * @param {Object} newRowCacheMap - current newRowCacheMap
 * @returns {Object} - cleared NewRowCacheMap
 */
export let clearNewRowCacheMap = function( newRowCacheMap ) {
    for( const key in newRowCacheMap ) {
        delete newRowCacheMap[ key ];
    }
    return newRowCacheMap;
};

/**
 * This function contains business logic to decide which type of object to add.
 * For performance reasons we have this logic to client.
 * This function will update the abstract object type for model families and models.
 * @param {Object} viewModelCollection - View model collection
 * @param {String} type - type of the object
 * @param {Object} commandContext - command context
 * @param {String} cachedFamilyAbstractObjectType - cached family abstract object type
 * @returns {Object} - Returns an object with abstractObjectType and familyAbstractObjectType
 */
export let getAbstractObjectType = async( viewModelCollection, type, commandContext, cachedFamilyAbstractObjectType ) => {
    let abstractObjectType = '';
    let familyAbstractObjectType = cachedFamilyAbstractObjectType;
    switch ( type ) {
        case 'group':
            abstractObjectType = pca0Constants.CFG_OBJECT_TYPES.ABS_FAMILY_GROUP;
            break;
        case 'family':
            familyAbstractObjectType = cachedFamilyAbstractObjectType || await _getFamilyAbstractObjectType();
            abstractObjectType = familyAbstractObjectType;
            break;
        case 'feature': {
            abstractObjectType = pca0Constants.CFG_OBJECT_TYPES.TYPE_REVISION;
            // LCS-940555 - Issues in Variability Explorer
            // If we author data for the first time using context menu add family command, the commandContext.selected is updated to correct selection, and selection is undefined.
            // As user switches to PWA add command for authoring feature the commandContext.selected old selection, which is group in this scenario,
            // and commandContext.selection is populated with updated selection.
            // So changed the precedence of the commandContext.selected with commandContext.selection. Which takes care of selectedObject is correctly populated in all the scenarios
            const selectedObject = commandContext.selection ? commandContext.selection[0] : commandContext.selected[0];
            const parentNode = viewModelCollection.getViewModelObject( viewModelCollection.findViewModelObjectById( selectedObject.parentUID ) );
            const parentTypeHierarchy = _.get( parentNode, 'modelType.typeHierarchyArray', [] );
            const parentFamilyType = _.get( parentNode, 'props.cfg0ValueDataType.dbValue', '' );

            // Checking if the parent of the selected object is of Boolean type, then setting the abstractObjectType as boolean feature.
            // Using that to show message to user that it is not supported.
            // To disable the 'Add Feature' command on boolean feature we had no information on the feature, thats why we are taking this approach.
            if( parentTypeHierarchy.includes( pca0Constants.CFG_OBJECT_TYPES.ABS_LITERAL_VALUE_FAMILY ) && parentFamilyType === 'Boolean' ) {
                abstractObjectType = 'boolFeature';
            } else if( _isPackageFeatureAuthAllowed( selectedObject ) ) {
                // If the selected object is Package family or package feature setting the abstract type as package feature.
                abstractObjectType = pca0Constants.CFG_OBJECT_TYPES.ABS_PACKAGE_OPTION_VALUE;
            } else if( _isSummaryFeatureAuthAllowed( selectedObject ) ) {
                // If the selected object is Summary family or summary feature setting the abstract type as summary feature.
                abstractObjectType = pca0Constants.CFG_OBJECT_TYPES.ABS_SUMMARY_OPTION_VALUE;
            } else if( _isStandaloneFeatureAuthAllowed( selectedObject ) ) {
                abstractObjectType = pca0Constants.CFG_OBJECT_TYPES.ABS_FEATURE;
            }
            break;
        }
        case 'modelFamily': {
            let productModelFamilyAvailable = _isProductModelFamilyAvailable( viewModelCollection );
            // After Model Family, Product Line Family is the default value for authoring new families in Models Tab
            abstractObjectType = productModelFamilyAvailable ? pca0Constants.CFG_OBJECT_TYPES.ABS_PRODUCT_LINE_FAMILY : pca0Constants.CFG_OBJECT_TYPES.ABS_PRODUCT_MODEL_FAMILY;
            break;
        }
        case 'model': {
            let selectedObject = commandContext.selection ? commandContext.selection[0] : commandContext.selected[0];
            if ( _isProductModelAuthAllowed( selectedObject ) ) {
                abstractObjectType = pca0Constants.CFG_OBJECT_TYPES.TYPE_PRODUCT_MODEL;
            } else if ( _isSummaryModelAuthAllowed( selectedObject ) ) {
                abstractObjectType = pca0Constants.CFG_OBJECT_TYPES.ABS_SUMMARY_MODEL;
            } else {
                abstractObjectType = pca0Constants.CFG_OBJECT_TYPES.ABS_PRODUCT_LINE;
            }
            break;
        }
        default:
            break;
    }
    return { abstractObjectType, familyAbstractObjectType };
};

/**
 * In a context only one product model family can be authored here we are checking if the product model family authoring is allowed or not
 * @param {Object} viewModelCollection - View model collection
 * @returns {Boolean} - Returns true if product model family authoring is allowed false otherwise
 */
export let isProductModelAuthoringAllowed = function( viewModelCollection ) {
    let isAllowed = true;
    let loadedVMOs = viewModelCollection.getLoadedViewModelObjects();
    // Get hold of all the product model families from the loaded VMOs
    const productModelVMOs = loadedVMOs.filter( inlineRow => inlineRow.absType === pca0Constants.CFG_OBJECT_TYPES.ABS_PRODUCT_MODEL_FAMILY ||
        inlineRow.modelType?.typeHierarchyArray.includes( pca0Constants.CFG_OBJECT_TYPES.ABS_PRODUCT_MODEL_FAMILY ) );
    // Examine the productModelVMOs based on the isEditing property and return true or false according to the following cases:
    // Case 1: If there is a non-editing productModel (saved), return isAllowed false, as an existing product model exists in the tree.
    // Case 2: If there are no non-editing productModels (saved), but only one editing product model, return isAllowed true.
    // Case 3: If there are more than one editing productModels (unsaved), return isAllowed false.
    const isEditing = productModelVMOs.filter( inlineRow => inlineRow.isEditing ).length;
    const nonEditing = productModelVMOs.filter( inlineRow =>  !inlineRow.isEditing  ).length;
    isAllowed = !( nonEditing > 0 || isEditing > 1 );
    return isAllowed;
};

/**
 * This function will replace the vmo of the inline row with updated vmo
 * Also It will merge the old vmo properties with the new one
 * @param {Object} newRowCacheMap - the new row CacheMap
 * @param {Object} treeDataProvider - tree data provider
 * @param {Object} eventData - event data
 * @param {Object} typeHierarchyResponse - typeHierarchyResponse of the object received from server
 * @param {Object} selectedVMO - selected VMO for which the properties are to be updated
 * @returns {Boolean} isProductModelAuthoringAllowed is returned true if productModel authoring is allowed
 */
export let replaceInlineVmoWithUpdatedProps = ( newRowCacheMap, treeDataProvider, eventData, typeHierarchyResponse, selectedVMO ) => {
    let viewModelCollection = treeDataProvider.getViewModelCollection();
    let viewModelObjects = [ ...viewModelCollection.getLoadedViewModelObjects() ];
    let isProductModelAuthoringAllowed = true;
    let existingParentNodeIdx = viewModelCollection.findViewModelObjectById( selectedVMO.uid );
    if( existingParentNodeIdx !== -1 ) {
        let editingRow = viewModelCollection.getViewModelObject( existingParentNodeIdx );
        let getViewModelForCreateResponse = { ...newRowCacheMap[ eventData.selectedObject.propInternalValue ] };
        if( getViewModelForCreateResponse ) {
            const vmo = parsingUtils.parseJsonString( getViewModelForCreateResponse.viewModelObject );
            const serverVMO = viewModelObjectSvc.constructViewModelObjectFromModelObject( vmo, 'EDIT' );
            let newVMO = viewModelObjectSvc.createViewModelObject( serverVMO, 'EDIT', null, vmo );
            // Updated the property values of new vmo object from old vmo object, provided old vmo object property is dirty
            _mergeDirtyPropsToNewVMO( newVMO, editingRow );
            // Updating the abs type based on the object type selected.
            // Disabling and changing properties based on object selected .
            //  -- Disabling Feature data type for Summary and Package family.
            //  -- Setting Multi select and Option True by default.
            //
            //  -- Disabling Feature data type for Dynamic Family.
            //  -- Setting Option True, and Feature Data Type to Boolean for Standalone Feature
            //  -- Disabling Multi Select, Option, and Free-Form for Standalone Feature
            let typeHierarchyList = typeHierarchyResponse.types[0].typeHierarchy.split( ',' );
            switch( true ) {
                case typeHierarchyList.includes( pca0Constants.CFG_OBJECT_TYPES.ABS_PACKAGE_OPTION_FAMILY ):
                    _updateSelectedInlineRow( pca0Constants.CFG_OBJECT_TYPES.ABS_PACKAGE_OPTION_FAMILY, editingRow );
                    break;
                case typeHierarchyList.includes( pca0Constants.CFG_OBJECT_TYPES.ABS_SUMMARY_OPTION_FAMILY ):
                    _updateSelectedInlineRow( pca0Constants.CFG_OBJECT_TYPES.ABS_SUMMARY_OPTION_FAMILY, editingRow );
                    break;
                case typeHierarchyList.includes( pca0Constants.CFG_OBJECT_TYPES.ABS_PACKAGE_OPTION_VALUE ):
                    _updateSelectedInlineRow( pca0Constants.CFG_OBJECT_TYPES.ABS_PACKAGE_OPTION_VALUE, editingRow );
                    break;
                case typeHierarchyList.includes( pca0Constants.CFG_OBJECT_TYPES.ABS_SUMMARY_OPTION_VALUE ):
                    _updateSelectedInlineRow( pca0Constants.CFG_OBJECT_TYPES.ABS_SUMMARY_OPTION_VALUE, editingRow );
                    break;
                case typeHierarchyList.includes( pca0Constants.CFG_OBJECT_TYPES.ABS_FEATURE_FAMILY ):
                    _updateSelectedInlineRow( pca0Constants.CFG_OBJECT_TYPES.ABS_FEATURE_FAMILY, editingRow );
                    break;
                case typeHierarchyList.includes( pca0Constants.CFG_OBJECT_TYPES.ABS_PRODUCT_MODEL_FAMILY ):
                    _updateSelectedInlineRow( pca0Constants.CFG_OBJECT_TYPES.ABS_PRODUCT_MODEL_FAMILY, editingRow );
                    isProductModelAuthoringAllowed = exports.isProductModelAuthoringAllowed( treeDataProvider.getViewModelCollection() );
                    break;
                case typeHierarchyList.includes( pca0Constants.CFG_OBJECT_TYPES.ABS_SUMMARY_MODEL_FAMILY ):
                    _updateSelectedInlineRow( pca0Constants.CFG_OBJECT_TYPES.ABS_SUMMARY_MODEL_FAMILY, editingRow );
                    break;
                case typeHierarchyList.includes( pca0Constants.CFG_OBJECT_TYPES.ABS_PRODUCT_LINE_FAMILY ):
                    _updateSelectedInlineRow( pca0Constants.CFG_OBJECT_TYPES.ABS_PRODUCT_LINE_FAMILY, editingRow );
                    break;
                case typeHierarchyList.includes( pca0Constants.CFG_OBJECT_TYPES.ABS_FEATURE ):
                    // This is to keep the standalone feature props as is when we change the type
                    // If this switch case is removed. It will reset all values as in Literal Value Family
                    break;
                case !_.isUndefined( editingRow.props.cfg0ValueDataType ):
                    _updateSelectedInlineRow( pca0Constants.CFG_OBJECT_TYPES.ABS_LITERAL_VALUE_FAMILY, editingRow );
                    break;
            }

            // Updating the icon depending on the type
            if( !_.isUndefined( editingRow.absType ) ) {
                const newIconURL = iconSvc.getTypeIconURL( editingRow.absType );
                editingRow.iconURL = newIconURL;
                editingRow.typeIconURL = newIconURL;
            }
            viewModelObjects.splice( existingParentNodeIdx, 1, editingRow );
        }
    }
    treeDataProvider.update( viewModelObjects );
    return isProductModelAuthoringAllowed;
};

/**
 * This function will check if OOTB object types are there in the applicable object type list.
 * If its there, it will return it otherwise the first object from the list.
 * @param {Object} response SOA response to be processed'
 * @param {String}  authoringType type of object being authored for which default type is to be computed (feature, family, group, model, etc.).
 * @return { String } BO type to be added by default, in case of feature and model the return type will be an array
 */
export let getDefaultBOTypeToAdd = ( response, authoringType ) => {
    const objectTypeDefaults = {
        [pca0Constants.CFG_OBJECT_TYPES.TYPE_LITERAL_VALUE_FAMILY]: pca0Constants.CFG_OBJECT_TYPES.TYPE_LITERAL_VALUE_FAMILY,
        [pca0Constants.CFG_OBJECT_TYPES.TYPE_FAMILY_GROUP]: pca0Constants.CFG_OBJECT_TYPES.TYPE_FAMILY_GROUP,
        [pca0Constants.CFG_OBJECT_TYPES.PRODUCT_MODEL_FAMILY]: pca0Constants.CFG_OBJECT_TYPES.PRODUCT_MODEL_FAMILY,
        [pca0Constants.CFG_OBJECT_TYPES.SUMMARY_MODEL_FAMILY]: pca0Constants.CFG_OBJECT_TYPES.SUMMARY_MODEL_FAMILY,
        [pca0Constants.CFG_OBJECT_TYPES.PRODUCT_LINE_FAMILY]: pca0Constants.CFG_OBJECT_TYPES.PRODUCT_LINE_FAMILY
    };
    const boTypes = pcaObjectTypeLOVComponentService.processSoaResponseForBOTypes( response );

    // Here we are checking if the OOTB bo types are available in the applicable bo types.
    // If its there, we are setting that as default object type, else we are using the first bo type available on the applicable type list.
    // If the authoringType is either 'feature' or 'model', we will return an array of the boTypes propInternalValues.
    // This will be helpful for caching the businessObjectConstantMap when there are invalid values stored in the database for the Cfg0DefaultValueType business constant on Family.
    if( authoringType !== 'feature' && authoringType !== 'model' ) {
        const objType = _.find( boTypes, obj => objectTypeDefaults[obj.propInternalValue] );
        return objType ? objectTypeDefaults[objType.propInternalValue] : boTypes[0].propInternalValue;
    }
    return boTypes.map( boType => boType.propInternalValue );
};

/**
 * Returns the map of applicable object types and the abstract bo types to use while creating further rows.
 * @param {Object} applicableObjectTypeCacheMap - original applicableObjectTypeCacheMap
 * @param {String} absType - the abstract type
 * @param {String} objType - the list to reuse
 * @returns {Object} - Returns new row cache
 */
export let cacheApplicableObjectType = ( applicableObjectTypeCacheMap, absType, objType ) => {
    let newCacheMap = { ...applicableObjectTypeCacheMap };
    _.set( newCacheMap, absType, objType );
    newCacheMap[ absType ] = objType;
    return newCacheMap;
};

/**
 * Returns the applicable object type of an Abstract bo type from cache map.
 * @param {Object} applicableObjectTypeCacheMap - original applicableObjectTypeCacheMap
 * @param {String} absType - the abstract type
 * @returns {String} - Returns object type
 */
export let getApplicableTargetObjectTypeFromCache = ( applicableObjectTypeCacheMap, absType ) => {
    return applicableObjectTypeCacheMap[ absType ];
};

/**
 * Filters the selected rows with successfully removed rows, and removes from UI.
 * @param {Object} eventData - event data
 * @param {String} treeDataProvider - tree data provider
 */
export let postRemovePartialScenarioHandler = ( eventData, treeDataProvider ) => {
    if( !eventData.ServiceData.deleted ) {
        return;
    }
    //Checks if allocationUid is there or not. (For Features)
    //If allocationUid is not present, filter on the basis of nodeUid. (For Models)
    const allocationUid = eventData.row[0].allocationUid;
    if( allocationUid ) {
        eventData.row = eventData.row.filter( vmo => eventData.ServiceData.deleted.includes( vmo.allocationUid ) );
    } else {
        eventData.row = eventData.row.filter( vmo => eventData.ServiceData.deleted.includes( vmo.nodeUid ) );
    }
    exports.removeSavedRowAndChildrenFromUi( eventData, treeDataProvider );
};

/**
 * The function will add/update the property 'saveInProgress' in ctx to true/false.
 * @param {Boolean} value - Value to be set.
 */
export let updateLockInlineAuthStatus = ( value ) => {
    let context = appCtxService.getCtx( veConstants.CONFIG_CONTEXT_KEY );
    if( context.lockInlineAuthoring === undefined ) {
        _.set( context.inlineAuthoringContext, 'lockInlineAuthoring', value );
    } else {
        context.inlineAuthoringContext.lockInlineAuthoring = value;
    }
    appCtxService.updatePartialCtx( veConstants.CONFIG_CONTEXT_KEY, context );
};

/**
 * This function will create and return allocationUidMap
 * @param {Object} viewModelCollection - View model collection for tree data provider
 * @returns {Object} - Returns allocationUidMap
 */
export let getAllocationUidMap = ( viewModelCollection ) => {
    let allocationUidMap = {};
    let loadedVMOs = viewModelCollection.getLoadedViewModelObjects();
    loadedVMOs.forEach( vmo => {
        if( vmo.allocationUid ) {
            allocationUidMap[ vmo.allocationUid ] = vmo.uid;
        }
    } );
    return allocationUidMap;
};

/**
 * This functions makes the Auxiliary property enabled for editing
 * This function is temporary fix for making Auxiliary property Editable. By default Framework should make this property Editable
 * This Changes should be reverted( CP : PLM897991 ) after the defect (LCS-993834 - Unable to edit property cfg0IsAuxiliary from AW) gets closed
 * @param {Object} treeDataProvider - tree data provider
 */

export let enableAuxiliaryForEdit = ( treeDataProvider ) => {
    let columns = treeDataProvider.columnConfig.columns;
    let isAuxiliaryColumn = _.find( columns, { propertyName: 'cfg0IsAuxiliary' } );

    // Check if the 'Is Auxiliary' Column is hidden or not, if hidden then dont modify the property
    if ( !isAuxiliaryColumn || isAuxiliaryColumn.hiddenFlag ) {
        return;
    }

    let viewModelCollection = treeDataProvider.getViewModelCollection();
    let viewModelObjects = viewModelCollection.getLoadedViewModelObjects();

    // Enable the Auxiliary property for editing only for Cfg0AbsLiteralValueFamily, Cfg0AbsFeature and Cfg0AbsSummaryOptionFamily
    for( let item in viewModelObjects ) {
        let parentTypeName = _.get( viewModelObjects[item], 'modelType.parentTypeName' );
        if( parentTypeName === 'Cfg0AbsLiteralValueFamily' || parentTypeName === 'Cfg0AbsFeature' || parentTypeName === 'Cfg0AbsSummaryOptionFamily' ) {
            viewModelObjects[item].props.cfg0IsAuxiliary.isEnabled = true;
        }
    }
    treeDataProvider.update( viewModelObjects );
};

/**
 * Returns the map of applicable object types and the abstract bo types to use while creating further rows.
 * @param {Object} response - getTypeConstantValues SOA response to be processed
 * @param {Object} applicableObjectTypeCacheMap - absType to applicableObjectType map
 * @param {Object} businessObjectConstantMap - businessObjectType to Cfg0DefaultValueType map
 * @param {String} currentSelection - Current selected row type
 * @param {String} absType - AbsType of variability type being authored
 * @return {Object} new value of businessObjectConstantMap to be updated
 */
export let cacheBusinessObjectConstantMap = ( response, applicableObjectTypeCacheMap, businessObjectConstantMap, currentSelection, absType ) => {
    let newCacheMap = { ...businessObjectConstantMap };
    // Check the constant values is an empty array.
    if ( response.constantValues.length > 0 ) {
        // Using nested destructuring to get the key, and value values from response
        const {
            key: {
                typeName
            },
            value
        } = response.constantValues[0];

        if ( applicableObjectTypeCacheMap[absType].includes( typeName ) ) {
            // If the variability being authored is Cfg0AbsFeature, it is effectively a family in data model.
            // We will have CfgDefaultValue business object constant available and value may be present there.
            // In this case ignore the BO constant value in case and just add the current selection key-value in newCacheMap.
            newCacheMap[currentSelection] = currentSelection;
        } else if ( applicableObjectTypeCacheMap[absType].includes( value ) ) {
            // If the SOA response value for Cfg0DefaultValueType is available in applicableObjectTypeCacheMap, assign absType-value key value in newCacheMap.
            newCacheMap[typeName] = value;
        } else {
            // Here if the invalid value is present for BO constant Cfg0DefaultValueType, we get the first applicable object value for the current object being authored.
            newCacheMap[typeName] = applicableObjectTypeCacheMap[absType][0];
        }
    } else {
        // If the response constantValues is an empty array, assign the currentSelection to the newCacheMap.
        // The response constantValues array is empty when we select feature or model type row while authoring feature/model. As features and models does not have,
        // Cfg0DefaultValueType business object constant associated these BOs.
        newCacheMap[currentSelection] = currentSelection;
    }
    return newCacheMap;
};

/**
 * Returns the applicable object type of an Abstract bo type from cache map.
 * @param {Object} businessObjectConstantMap - businessObjectConstantMap
 * @param {String} objType - selected inline row object type
 * @returns {String} - Returns object type
 */
export let getBusinessObjectConstantValue = ( businessObjectConstantMap, objType ) => {
    return businessObjectConstantMap[ objType ];
};

export default exports = {
    addChildToParentsChildrenArray,
    renderInlineRow,
    cancelEdits,
    saveEdits,
    populateVisiblePropertyList,
    resetInlineDataCache,
    updateUnsavedRows,
    updateInlineRowVMOPropertiesForReuse,
    populateInlineRows,
    postSaveHandler,
    removeInlineRowsAfterSave,
    cacheInlineRowFromServerResponse,
    removeUnsavedChildrenAfterLovValueChange,
    reverseWidgetSelectionChange,
    removeUnsavedRow,
    removeSavedRowAndChildrenFromUi,
    updateColumnConfig,
    confirmationForWidgetSelectionChange,
    populateParentElement,
    removeEditHandler,
    discardAllUnsavedRows,
    isAllowedToSave,
    selectFirstUnsavedRow,
    updateMinMaxValueTypeBasedOnFamilyDataType,
    selectNextUnsavedRow,
    getObjectsToDelete,
    updatePreviousSelectedLovType,
    cacheLoadedObjectTypes,
    resetLoadingStatus,
    getTypesToInclude,
    sortRowsByLevel,
    clearNewRowCacheMap,
    getAbstractObjectType,
    isProductModelAuthoringAllowed,
    replaceInlineVmoWithUpdatedProps,
    getDefaultBOTypeToAdd,
    cacheApplicableObjectType,
    getApplicableTargetObjectTypeFromCache,
    postRemovePartialScenarioHandler,
    updateLockInlineAuthStatus,
    getAllocationUidMap,
    enableAuxiliaryForEdit,
    cacheBusinessObjectConstantMap,
    getBusinessObjectConstantValue
};
