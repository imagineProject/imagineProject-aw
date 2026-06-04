// Copyright (c) 2022 Siemens

/**
 * Service responsible for creating, updating and copying Saved Working Context
 *
 * @module js/saveWorkingContextService
 */
import soaSvc from 'soa/kernel/soaService';
import cdm from 'soa/kernel/clientDataModel';
import cmm from 'soa/kernel/clientMetaModel';
import AwPromiseService from 'js/awPromiseService';
import addObjectUtils from 'js/addObjectUtils';
import uwPropertyService from 'js/uwPropertyService';
import viewModelObjectService from 'js/viewModelObjectService';
import omStateHandler from 'js/occurrenceManagementStateHandler';
import eventBus from 'js/eventBus';
import occmgmtUtils from 'js/occmgmtUtils';
import _dmSrv from 'soa/dataManagementService';
import _ from 'lodash';

var exports = {};

var AWB0AUTOBOOKMARK = 'awb0AutoBookmark';
var AWB0SOURCEAUTOBOOKMARK = 'awb0SourceAutoBookmark';
var AWB0_READ_SHARE = 'awb0AllowReadShare';
var AWB0_WRITE_SHARE = 'awb0AllowWriteShare';
var LAST_MOD_DATE = 'last_mod_date';

/**
 * Set Auto-assigned Name for SWC ( based upon operation type )
 *
 * @param {Object} data - Saved Working Context panel's data object
 */
var setObjectName = function( data, createXrtVmo ) {
    var objectName = null;

    if( data && data.operationType && data.openedObject ) {
        var openedObjectName = data.openedObject.props.object_name.dbValues[ 0 ];

        switch ( data.operationType ) {
            case 'CREATE':
                //Auto-assigned Name = "Context for " + openedObjectName;
                objectName = occmgmtUtils.getLocalizedMessage( 'OccurrenceManagementMessages',
                    'workingContextName', openedObjectName );
                break;
            case 'SAVEAS':
                //Auto-assigned Name = "Copy of " + openedObjectName;
                objectName = occmgmtUtils.getLocalizedMessage( 'OccurrenceManagementMessages',
                    'saveAsWorkingContextName', openedObjectName );
                break;
        }
        if( objectName ) {
            createXrtVmo.props.object_name.dbValues = [ objectName ];
            createXrtVmo.props.object_name.uiValues = [ objectName ];
        }

        if( data.operationType !== 'UPDATE' ) {
            createXrtVmo.props.object_name.valueUpdated = true;
            var eventData = {
                objectName: objectName
            };
            eventBus.publish( 'assignInitialValues', eventData );
        }
    }
};

export let processSessionTypes = function( data ) {
    var sessionTypeNames = [];
    for( var typeIndex = 0; typeIndex < data.output[ 0 ].creatableBONames.length; typeIndex++ ) {
        sessionTypeNames.push( data.output[ 0 ].creatableBONames[ typeIndex ].boName );
    }
    return sessionTypeNames;
};

/**
 * Initialize the Save Working Context Type Selector Section
 *
 * @param {Object} typeList - Saved Working Context  object type list
 */
export let populateSWCTypes = function( typeList ) {
    if( _.isUndefined( typeList ) || typeList.length <= 0 ) {
        var containerList = omStateHandler.getSWCContainerNames();
        return soaSvc.ensureModelTypesLoaded( containerList ).then( function() {
            typeList = convertStringsToLovEntries( containerList );
            return AwPromiseService.instance.resolve( { typeList } );
        } );
    }
    return AwPromiseService.instance.resolve( { typeList } );
};

/**
 * Set the ViewModelProperty for AWB0SOURCEAUTOBOOKMARK Get AWB0AUTOBOOKMARK property from Product Context Info
 * and assign it to AWB0SOURCEAUTOBOOKMARK
 *
 * @param {Object} data - Saved Working Context panel's data object
 */
export let getSourceAutoBookmarkProperty = function( data ) {
    var sourceABMProp = undefined;
    if( data ) {
        var pci = omStateHandler.getProductContextInfo();
        if( pci ) {
            sourceABMProp = uwPropertyService.createViewModelProperty( AWB0SOURCEAUTOBOOKMARK,
                'Source AutoBookmark', 'STRING', pci.props[ AWB0AUTOBOOKMARK ].dbValues[ 0 ], '' );
            sourceABMProp.uiValue = pci.props[ AWB0AUTOBOOKMARK ].uiValues[ 0 ];
            sourceABMProp.valueUpdated = true;
        }
    }
    return sourceABMProp;
};

/**
 * Get the opened product
 */
var getProduct = function() {
    var pci = omStateHandler.getProductContextInfo();
    if( pci ) {
        return cdm.getObject( pci.props.awb0Product.dbValues[ 0 ] );
    }
};

/**
 * Check if we are creating an instance of Awb0SavedBookmark
 */
var checkIfTargetTypeIsSavedBookmark = function( swcTypes ) {
    var swcTypeNames = [];
    if( swcTypes && swcTypes.length > 0 ) {
        _.forEach( swcTypes, function( swcType ) {
            let typeName = swcType.object.props.type_name.dbValue ? swcType.object.props.type_name.dbValue : swcType.object.props.type_name.dbValues[ 0 ];
            swcTypeNames.push( typeName );
        } );
    }

    return swcTypeNames.indexOf( 'Awb0SavedBookmark' ) > -1;
};

/**
 * Initialize the Save Working Context Panel for CREATE / SAVEAS operations
 *
 * @param {Object} typeList - Saved Working Context object type list
 * @param {Object} workingContextObj - Save working context object
 * @returns {Object} panel initialization info
 *
 */
export let initializeCreateSWCPanel = function( typeList, workingContextObj ) {
    var targetTypeIsSavedBookmark = checkIfTargetTypeIsSavedBookmark( typeList );
    var swcTypeDisplayName = occmgmtUtils.getLocalizedMessage( 'OccurrenceManagementConstants', 'type', null );
    var operationType = '';
    var openedObject;
    var contextTitle = '';
    var buttonText = '';


    if( _.isUndefined( workingContextObj ) ) {
        operationType = 'CREATE';
        openedObject = getProduct();
        contextTitle = occmgmtUtils.getLocalizedMessage( 'OccmgmtSavedWorkingContextConstants',
            'workingContextTitle', null );
        buttonText = occmgmtUtils.getLocalizedMessage( 'OccurrenceManagementConstants', 'saveButtonText', null );
    } else {
        operationType = 'SAVEAS';
        openedObject = workingContextObj;
        contextTitle = occmgmtUtils.getLocalizedMessage( 'OccmgmtSavedWorkingContextConstants',
            'saveAsWorkingContextTitle', null );
        buttonText = occmgmtUtils.getLocalizedMessage( 'OccurrenceManagementConstants', 'saveAsButtonText',
            null );
    }

    return exports.populateSWCTypes( typeList ).then(
        function( swcTypesResult ) {
            return { ...swcTypesResult, swcTypeDisplayName, targetTypeIsSavedBookmark, operationType, openedObject, contextTitle, buttonText };
        }
    );
};

/**
 * Find the properties of the opened object that should be loaded for CREATE / SAVEAS / UPDATE operation to
 * succeed
 *
 * @param {Object} data - Saved Working Context panel's data object
 */
export let findPropsToLoad = function( data ) {
    var propsToLoad = [];
    if( data.operationType === 'CREATE' ) {
        propsToLoad.push( 'object_name' );
    } else {
        if( !_.isUndefined( data.xrtData.data.objects ) ) {
            let xrtObject = Object.values( data.xrtData.data.objects )[ 0 ][ 0 ];
            propsToLoad.push( ...Object.keys( xrtObject.props ) );
            propsToLoad.push( AWB0_READ_SHARE );
            propsToLoad.push( AWB0_WRITE_SHARE );

            if( data.operationType === 'UPDATE' ) {
                propsToLoad.push( LAST_MOD_DATE );
                propsToLoad.push( 'owning_user' );
            }
        }
    }

    return propsToLoad;
};

/**
/**
 * Initialize the Save Working Context Panel for UPDATE operation
 *
 * @param {Object} workingContextObj - Saved Working Context object
 * @returns {Object} panel initialization info
 */
export let initializeUpdateSWCPanel = function(  workingContextObj ) {
    var operationType = 'UPDATE';
    var targetTypeIsSavedBookmark = true;
    var swcContainerNames = [];
    swcContainerNames.push( workingContextObj.type );
    return soaSvc.ensureModelTypesLoaded( swcContainerNames ).then( function() {
        var typeDisplayName = occmgmtUtils.getLocalizedMessage( 'OccurrenceManagementConstants', 'type', null );
        var openedObject = workingContextObj;
        var type = openedObject.modelType;
        var swcType = uwPropertyService.createViewModelProperty( 'swcType', typeDisplayName, 'STRING', type.name, type.displayName );
        swcType.dbValue = type.name;
        swcType.uiValue = type.displayName;
        swcType.dispValue = type.displayName;
        return {
            openedObject,
            operationType,
            targetTypeIsSavedBookmark,
            swcContainerNames,
            swcType
        };
    } );
};

/**
 * Auto populate XRT panel fields: 'object_name' for CREATE operation, all view model properties for SAVEAS,
 * UPDATE operations. Add AWB0SOURCEAUTOBOOKMARK to the properties to create and set the value.
 *
 * @param {Object} data - Saved Working Context panel's data object
 */
export let populateCreateInputPanel = function( data ) {
    var createXrtVmo = null;
    let xrtDataIn = { ...data.xrtData };

    if( !_.isUndefined( xrtDataIn.data.objects ) ) {
        _.forEach( xrtDataIn.data.objects, function( vmo, uid ) {
            createXrtVmo = vmo[ 0 ];
        } );
    }

    if( data.targetTypeIsSavedBookmark ) {
        if( data.operationType === 'SAVEAS' || data.operationType === 'UPDATE' ) {
            var sourcevmo = viewModelObjectService.createViewModelObject( data.openedObject.uid );
            for( var index = 0; index < data.propsToLoad.length; index++ ) {
                var loadedPropName = data.propsToLoad[ index ];
                if( createXrtVmo.props[ loadedPropName ] && sourcevmo.props[ loadedPropName ] ) {
                    createXrtVmo.props[ loadedPropName ].dbValues = sourcevmo.props[ loadedPropName ].dbValues;
                    createXrtVmo.props[ loadedPropName ].uiValues = sourcevmo.props[ loadedPropName ].uiValues;
                }
            }
        }
    }
    setObjectName( data, createXrtVmo );

    return { xrtDataIn, sourcevmo };
};

export let syncModifiedVMOProps = function( data, editHandler ) {
    let sourcevmo = data.sourcevmo;
    var createInput = addObjectUtils.getCreateInput( data, null, null, editHandler );
    if( data.targetTypeIsSavedBookmark ) {
        var propertyNameValues = createInput[ 0 ].createData.propertyNameValues;
        for( var propName in propertyNameValues ) {
            if( propertyNameValues[propName] ) {
                sourcevmo.props[propName].dbValue = propertyNameValues[propName];
                sourcevmo.props[propName].dbValues = propertyNameValues[propName];
                sourcevmo.props[propName].uiValues = propertyNameValues[propName];
                sourcevmo.props[propName].valueUpdated = true;
            }
        }
    }

    return { sourcevmo };
};

/**
 * Keep the Read Share and Write Share properties in logical sync.
 *
 * @param {Object} data - SWC custom panel's data object
 */
export let keepShareAttrsInSync = function( data ) {
    var readShareValue = data.awb0AllowReadShare.dbValue;
    var writeShareValue = data.awb0AllowWriteShare.dbValue;

    if( data.awb0AllowReadShare.dbValue === false ) {
        writeShareValue = false;
    }
    if( data.awb0AllowWriteShare.dbValue === true ) {
        readShareValue = true;
    }

    var eventData = {
        awb0AllowWriteShare: writeShareValue,
        awb0AllowReadShare: readShareValue

    };
    eventBus.publish( 'swcShareAttribute.changed', eventData );

    return { readShareValue, writeShareValue };
};

export let updateReadWriteShare = function( sourcevmo, eventData ) {
    let updateSWC = false;
    if( sourcevmo && sourcevmo.props ) {
        var oldReadShareVal = sourcevmo.props.awb0AllowReadShare.dbValues[ 0 ] === '1';
        var oldWriteShareVal = sourcevmo.props.awb0AllowWriteShare.dbValues[ 0 ] === '1';
        updateSWC = oldReadShareVal !==  eventData.awb0AllowReadShare || oldWriteShareVal !==  eventData.awb0AllowWriteShare;
    }
    return { awb0AllowReadShare: eventData.awb0AllowReadShare, awb0AllowWriteShare: eventData.awb0AllowWriteShare, updateSWC };
};

export let getCreateInput = function( data, editHandler ) {
    var createInput = addObjectUtils.getCreateInput( data, null, null, editHandler );
    if( data.targetTypeIsSavedBookmark ) {
        //Topup with autobookmark
        var propertyNameValues = createInput[ 0 ].createData.propertyNameValues;
        if( data.awb0AllowReadShare && typeof data.awb0AllowReadShare === 'boolean' ) {
            propertyNameValues.awb0AllowReadShare = [ data.awb0AllowReadShare.toString() ];
        }
        if( data.awb0AllowWriteShare && typeof data.awb0AllowWriteShare === 'boolean' ) {
            propertyNameValues.awb0AllowWriteShare = [ data.awb0AllowWriteShare.toString() ];
        }
        if( data.awb0SourceAutoBookmark ) {
            propertyNameValues.awb0SourceAutoBookmark = [ data.awb0SourceAutoBookmark.dbValue ];
        }
    }
    return createInput;
};

/**
 * Gets the created object from createRelateAndSubmitObjects SOA response. Returns ItemRev if the creation type
 * is subtype of Item.
 *
 * @param {Object} the response of createRelateAndSubmitObjects SOA call
 * @return the created object
 */
export let getCreatedObject = function( response ) {
    var createdObjects = addObjectUtils.getCreatedObjects( response );
    if( createdObjects && createdObjects.length > 0 ) {
        return createdObjects[ 0 ];
    }
    return null;
};

/**
 * Gets ObjectSetUri from occContext and returns it to update occDataProvider.
 * @param {object} subPanelContext - subPanelContext
 */
export let updateObjectSetUri = function( subPanelContext ) {
    var objectSetUri = subPanelContext.occContext.objectSetUri;
    return { objectSetUri };
};

/**
 *  Builds the input for saveViewModelEditAndSubmitWorkflow2 soa call
 * @param {object} data
 * @return viewModelProperties array
 */
export let getViewModelProperties = function( data ) {
    var viewModelProps = [];
    var lsdData = null;
    var modelObjects = [];
    if( data.viewModelObjectsJsonStrings && data.viewModelObjectsJsonStrings.length > 0 ) {
        modelObjects = JSON.parse( data.viewModelObjectsJsonStrings[0] ).objects;
        if ( modelObjects.length > 0 ) {
            lsdData = modelObjects[0].props[Object.keys( modelObjects[0].props )[0]].srcObjLsd;
        }
    }
    var modifiedProperties = data.sourcevmo.getDirtyProps();
    for ( let index = 0; index < modifiedProperties.length; index++ ) {
        var viewModelProp = {
            dbValues: modifiedProperties[index].values,
            uiValues: modifiedProperties[index].values,
            intermediateObjectUids: [],
            propertyName: modifiedProperties[index].name,
            srcObjLsd: lsdData
        };
        viewModelProps.push( viewModelProp );
    }

    return viewModelProps;
};


const convertStringsToLovEntries = function( strings ) {
    var listModels = [];

    _.forEach( strings, function( str ) {
        var listModel = _getEmptyListModel();

        if( cmm.containsType( str ) ) {
            var type = cmm.getType( str );
            listModel.propDisplayValue = type.displayName;
            listModel.propInternalValue = type.name;

            _dmSrv.loadObjects( [ type.uid ] ).then( function( ) {
                var tmpObj = cdm.getObject( type.uid );
                // set type_name on props
                tmpObj.props.type_name = tmpObj.props.object_string;
                tmpObj.props.type_name.dbValues = [ type.name ];
                listModel.object = tmpObj;
            } );
        } else {
            listModel.propDisplayValue = str;
            listModel.propInternalValue = str;
        }
        listModels.push( listModel );
    } );

    return listModels;
};

/**
 * Return an empty ListModel object.
 *
 * @return {Object} - Empty ListModel object.
 */
var _getEmptyListModel = function() {
    return {
        propDisplayValue: '',
        propInternalValue: '',
        propDisplayDescription: '',
        hasChildren: false,
        children: {},
        sel: false
    };
};

/**
 * Save Working Context service utility
 */

export default exports = {
    populateSWCTypes,
    processSessionTypes,
    initializeCreateSWCPanel,
    findPropsToLoad,
    initializeUpdateSWCPanel,
    populateCreateInputPanel,
    keepShareAttrsInSync,
    updateReadWriteShare,
    getSourceAutoBookmarkProperty,
    getCreateInput,
    getCreatedObject,
    syncModifiedVMOProps,
    updateObjectSetUri,
    getViewModelProperties
};
