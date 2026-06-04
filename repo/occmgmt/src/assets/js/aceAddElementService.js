// Copyright (c) 2022 Siemens

/**
 * @module js/aceAddElementService
 */
import adapterSvc from 'js/adapterService';
import addObjectUtils from 'js/addObjectUtils';
import appCtxService from 'js/appCtxService';
import AwPromiseService from 'js/awPromiseService';
import clipboardService from 'js/clipboardService';
import cfgSvc from 'js/configurationService';
import dateTimeSvc from 'js/dateTimeService';
import eventBus from 'js/eventBus';
import localeService from 'js/localeService';
import navigationUtils from 'js/navigationUtils';
import occmgmtUtils from 'js/occmgmtUtils';
import occurrenceManagementStateHandler from 'js/occurrenceManagementStateHandler';
import _uwPropSrv from 'js/uwPropertyService';
import viewModelObjectService from 'js/viewModelObjectService';
import _ from 'lodash';
import cdm from 'soa/kernel/clientDataModel';
import cmm from 'soa/kernel/clientMetaModel';

var exports = {};
const _OCCMGMTCONSTANTS = 'OccurrenceManagementConstants';
const _PSOCCURRENCE = 'PSOccurrence';
const _FND0PRODUCTITEM = 'fnd0ProductItem';
const _FND0COORDINATESYSTEMTYPE = 'Fnd0CoordSystem';

var ensureActiveContextIsCreated = function() {
    if( !appCtxService.ctx.aceActiveContext ) {
        appCtxService.updatePartialCtx( 'aceActiveContext.context', {} );
    }
};

export let getElementTobeReplaced = function( data ) {
    if( data.splitElement ) {
        return data.splitElement;
    }
    return data.eventMap['saveAsAndReplace.saveAs'].selectedObjectForReplaceElement;
};

export let getDisplayMode = function() {
    return 'Tree'; //Server expects 'Tree' in case of Table mode as well.
};

export let getExpandedValue = function( occContext, targetObject, fetchOccurrenceTypesFor ) {
    if( fetchOccurrenceTypesFor && ( fetchOccurrenceTypesFor === 'substituteGroup' || fetchOccurrenceTypesFor === 'secondaryComponent' ) ) {
        // In case of 'ADD Substitute Component' and 'ADD Secondary Component' addObject SOA should return all children under the parent
        // so we return ExpandedValue as 'false' so that addObject SOA will expand the parent.
        return 'false';
    }
    var parent = targetObject ? targetObject.uid : occContext?.currentState?.c_uid;
    var vmc = occContext?.vmc;
    if( parent && vmc ) {
        var parentIdx = _.findLastIndex( vmc.getLoadedViewModelObjects(), function( vmo ) {
            return vmo.uid === parent;
        } );
        if( parentIdx > -1 ) {
            var parentVMO = vmc.getViewModelObject( parentIdx );
            if ( parentVMO.isExpanded ) {
                return 'true';
            }
        }
    }
    return 'false';
};

export let getSeperateQuantityAndPrepareAddInput = function() {
    exports.updateCtxForAceAddSiblingPanel();
    let addElementInput = appCtxService.ctx.aceActiveContext.context.addElementInput;
    if( occmgmtUtils.isTreeView() ) {
        addElementInput.fetchPagedOccurrences = true;
    }
    addElementInput.seperateQuantity = appCtxService.ctx.selected.props.awb0Quantity.dbValues[ 0 ] - 1;
    addElementInput.parent = appCtxService.ctx.aceActiveContext.context.addElementInput.parentElement;

    appCtxService.updatePartialCtx( 'aceActiveContext.context.addElement', addElementInput );
};

/**
 * set the variablity for Add child Panel
 */
export let setCtxAddElementInputParentElementToSelectedElement = function( parent, parentForAllowedTypes ) {
    var addElementInput = {};
    addElementInput.parentElement = viewModelObjectService
        .createViewModelObject( parent ? parent.uid : appCtxService.ctx.selected.uid );

    addElementInput.parentToLoadAllowedTypes = viewModelObjectService
        .createViewModelObject( parentForAllowedTypes ? parentForAllowedTypes.uid : appCtxService.ctx.selected.uid );

    ensureActiveContextIsCreated();

    appCtxService.updatePartialCtx( 'aceActiveContext.context.addElementInput', addElementInput );
};

/**
 * set the variablity for Add sibling Panel
 */
export let updateCtxForAceAddSiblingPanel = function() {
    var addElementInput = {};
    addElementInput.parentElement = viewModelObjectService
        .createViewModelObject( appCtxService.ctx.selected.props.awb0Parent.dbValues[ 0 ] );
    addElementInput.siblingElement = appCtxService.ctx.selected;
    // For adding a sibling, make sure that the parent for allowed types is populated properly.
    // In case of adding a sibling the parent is being calculated properly above and we need to set that here as well.
    addElementInput.parentToLoadAllowedTypes = addElementInput.parentElement;
    ensureActiveContextIsCreated();
    appCtxService.updatePartialCtx( 'aceActiveContext.context.addElementInput', addElementInput );
};

var saveCurrentSelectionUidToCheckSelectionChange = function( addElement ) {
    addElement.previousSelectionUid = appCtxService.ctx.selected.uid;
};

/**
 * Process input passed by consumer to the add element
 */
export let processAddElementInput = function() {
    var activeContext = appCtxService.ctx.aceActiveContext.context || {};
    var addElementInput = activeContext.addElementInput || {};
    var addElement = {};

    // set default values
    saveCurrentSelectionUidToCheckSelectionChange( addElement );
    addElement.parent = appCtxService.ctx.selected;
    addElement.parentToLoadAllowedTypes = appCtxService.ctx.selected;
    addElement.reqPref = exports.populateRequestPref();
    addElement.siblingElement = {};
    addElement.isCopyButtonEnabled = !occurrenceManagementStateHandler
        .isFeatureSupported( 'HideAddCopyButtonFeature_32' );
    addElement.operationType = 'Union';
    if( occmgmtUtils.isTreeView() ) {
        addElement.fetchPagedOccurrences = true;
    }

    // process custom input or extension values
    _.forEach( addElementInput, function( value, key ) {
        switch ( key ) {
            case 'parentElement':
                addElement.parent = value;
                break;
            case 'siblingElement':
                addElement.siblingElement = value;
                break;
            case 'parentToLoadAllowedTypes':
                addElement.parentToLoadAllowedTypes = value;
                break;
            case 'isCopyButtonEnabled':
                addElement.isCopyButtonEnabled = addElement.isCopyButtonEnabled && value;
                break;
            case 'addObjectIntent':
                addElement.addObjectIntent = value;
                break;
            case 'fetchPagedOccurrences':
                addElement.fetchPagedOccurrences = value;
                break;
            default:
                break;
        }
    } );

    // set the addElement
    appCtxService.updatePartialCtx( 'aceActiveContext.context.addElement', addElement );
    eventBus.publish( 'addElement.getInfoForAddElementAction' );
};

/**
 * Returns reqPref
 */
export let populateRequestPref = function() {
    var stateSvc = navigationUtils.getState();
    var toParams = {};

    if( stateSvc.params.fd ) {
        toParams.fd = [ stateSvc.params.fd ];
    }

    toParams.restoreAutoSavedSession = [ 'true' ];

    toParams.useGlobalRevRule = [ 'false' ];
    if( stateSvc.params.useGlobalRevRule ) {
        toParams.useGlobalRevRule[ 0 ] = stateSvc.params.useGlobalRevRule;
    }

    if( stateSvc.params.usepinx ) {
        toParams.useProductIndex = [ stateSvc.params.usepinx ];
    }

    toParams.calculateFilters = [ 'false' ];
    if( stateSvc.params.isfilterModified ) {
        toParams.calculateFilters[ 0 ] = 'true';
    }

    if( stateSvc.params.customVariantRule ) {
        toParams.customVariantRule = [ stateSvc.params.customVariantRule ];
    }
    _.forEach( appCtxService.ctx.aceActiveContext.context.persistentRequestPref, function( value, name ) {
        if( !_.isUndefined( value ) ) {
            toParams[ name ] = [ value.toString() ];
        }
    } );
    return toParams;
};

/**
 * Returns elements to be added either newly created or elements selected from Palette and Search tabs
 */
export let getElementsToAdd = function( createdObject, sourceObjects ) {
    // Priority is given to the created object. If it is present, it will be returned.
    // In the case of an add copy operation, where both createdObject and sourceObjects are present, the createdObject will be returned.
    if( Array.isArray( createdObject ) ) {
        return createdObject;
    }

    // check if created a new object ? if yes, create an array, insert this newly created element in it and return
    if( createdObject && Object.keys( createdObject ).length > 0 ) {
        var objects = [];
        objects.push( createdObject );
        return objects;
    }

    // return all selected element from palette and search tabs
    return sourceObjects;
};

/**
 * Returns elements to be replaced either newly created or element selected from Palette and Search tabs
 */
export let getElementsToReplace = function( createdObject, sourceObjects ) {
    var result = exports.getElementsToAdd( createdObject, sourceObjects );
    if( result && result.length === 1 ) {
        return result[ 0 ];
    }
};

/**
 * Returns list of PCI.
 */
export let getProductContextInfos = function( occContext ) {
    if( occContext.elementToPCIMap ) {
        var elementToPCIMapValues = Object.values( occContext.elementToPCIMap );
        var listOfPCI = [];
        for ( const value of elementToPCIMapValues ) {
            listOfPCI.push( cdm.getObject( value ) );
        }
        return listOfPCI;
    }

    return [ occContext.productContextInfo ];
};

/**
 * Returns list of uids for input list of replaced elements
 */
export let getReplacedElementsUids = function( replacedElements ) {
    return replacedElements.map( replacedElement => replacedElement.uid );
};

export let setOperation = function( selectedOperation, operation ) {
    let op = { ...operation.value };
    op.name = selectedOperation;
    operation.update( op );
};

export let setReplaceMode = function( replaceMode, operation ) {
    operation.dbValue = replaceMode;
    return operation;
};

// Resets number of elements value to 1
export let resetNumberOfElements = function( numberOfElements ) {
    if( numberOfElements ) {
        numberOfElements.dbValue = 1;
        numberOfElements.dispValue = 1;
        return numberOfElements;
    }
    return 1;
};

export let getNumberOfElements = function( addElementState, numberOfElementsOnly, data ) {
    return addElementState.numberOfElements.dbValue ? addElementState.numberOfElements.dbValue : numberOfElementsOnly.dbValue;
};

export let setUnderlyingObjectsOfSourceObjectsAndReturn = function( data, sourceObjects ) {
    var underlyingObjects = [];
    for( var i in sourceObjects ) {
        if( sourceObjects[ i ].modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) {
            var obj = cdm.getObject( sourceObjects[ i ].props.awb0UnderlyingObject.dbValues[ 0 ] );
            if( obj ) {
                underlyingObjects.push( obj );
            }
        } else {
            underlyingObjects.push( sourceObjects[ i ] );
        }
    }
    if( data.dispatch ) {
        data.dispatch( { path: 'data.underlyingObjects',   value: underlyingObjects } );
    }
    return underlyingObjects;
};

/**
 * This will create input for Save As Soa while creating copy of existing object
 *
 * @data data
 */
export let createSaveAsInput = function( data ) {
    var saveAsInput = [];
    var relateInfo = [];

    if( data.underlyingObjects ) {
        for( var index in data.underlyingObjects ) {
            var targetObject = data.underlyingObjects[ index ];

            var a;
            for( var b in data.deepCopyInfoMap[ 0 ] ) {
                if( data.deepCopyInfoMap[ 0 ][ b ].uid === targetObject.uid ) {
                    a = b;
                    break;
                }
            }
            var deepCopyInfoMap = data.deepCopyInfoMap[ 1 ][ a ];
            processDeepCopyDataArray( deepCopyInfoMap );

            var input = {
                targetObject: targetObject,
                saveAsInput: {},
                deepCopyDatas: deepCopyInfoMap
            };
            fillPropertiesInSaveAsInput( input.saveAsInput, targetObject );
            saveAsInput.push( input );
            relateInfo.push( {
                relate: true
            } );
        }
    }

    return {
        relateInfo: relateInfo,
        saveAsInput: saveAsInput
    };
};

/**
 * Process deep copy data array
 */
function processDeepCopyDataArray( deepCopyDataArray ) {
    for( var index = 0; index < deepCopyDataArray.length; index++ ) {
        var deepCopyData = deepCopyDataArray[ index ];
        deepCopyData.saveAsInput = {};

        var attachedObjectdVmo = viewModelObjectService
            .createViewModelObject( deepCopyData.attachedObject.uid );
        fillPropertiesInSaveAsInput( deepCopyData.saveAsInput, attachedObjectdVmo );

        delete deepCopyData.attachedObject.className;
        delete deepCopyData.attachedObject.objectID;

        var childDeepCopyDataArray = deepCopyData.childDeepCopyData;
        if( childDeepCopyDataArray ) {
            processDeepCopyDataArray( childDeepCopyDataArray );
        }
    }
}

/**
 * Fill properties in SaveAsInput object
 */
function fillPropertiesInSaveAsInput( saveAsInput, targetObject ) {
    saveAsInput.boName = targetObject.type;
    var propertiesToInclude = [ 'object_desc' ];
    saveAsInput.stringProps = saveAsInput.stringProps || {};
    for( var property in propertiesToInclude ) {
        var propName = propertiesToInclude[ property ];
        if( targetObject.props[ propName ] && targetObject.props[ propName ].dbValues[ 0 ] ) {
            saveAsInput.stringProps[ propName ] = targetObject.props[ propName ].dbValues[ 0 ];
        }
    }
}

export let getAddElementResponse = function( response, parentElements ) {
    var selectedNewElementInfos = response.selectedNewElementInfo ? [ response.selectedNewElementInfo ] : _prepareSelectedElementInfo( response, parentElements );

    return {
        selectedNewElementInfos: selectedNewElementInfos,
        newlyAddedChildElements: _getNewlyAddedChildElements( response, selectedNewElementInfos ),
        newElementInfos: response.newElementInfos,
        reloadContent: response.reloadContent,
        created: response.ServiceData.created,
        deleted: response.ServiceData.deleted,
        updated: response.ServiceData.updated,
        modelObjects: response.ServiceData.modelObjects,
        numChildrenAdded: response.numChildredAdded,
        numUpdatedParents: response.numUpdatedParents,
        partialErrors: response.ServiceData.partialErrors,
        hasErrorPresentInPartialErrors: _hasErrorPresentInPartialErrors( response?.ServiceData?.partialErrors )
    };
};

let _hasErrorPresentInPartialErrors = function( partialErrors ) {
    if( partialErrors && partialErrors.length > 0 ) {
        for( let i = 0; i < partialErrors.length; i++ ) {
            for( let j = 0; j < partialErrors[ i ].errorValues.length; j++ ) {
                // If error level is greater than or equal to 3, then it is an error else it is a warning or information.
                if( partialErrors[ i ].errorValues[ j ].level >= 3 ) {
                    return true;
                }
            }
        }
    }
    return false;
};

let _prepareSelectedElementInfo = function( response, parentElements ) {
    var selectedNewElementInfos = [];
    var newElementInfos = response.newElementInfos;
    if( newElementInfos?.length > 0 && parentElements && parentElements.length > 0 ) {
        newElementInfos.forEach( function( newElementInfo ) {
            if( newElementInfo.newElements ) {
                let isParentPresent = parentElements?.find( parentElement => parentElement?.uid === newElementInfo.parentElement.uid );
                if( isParentPresent ) {
                    var selectedNewElementInfo = {
                        newElements: []
                    };
                    newElementInfo.newElements.forEach( function( newElement ) {
                        selectedNewElementInfo.newElements.push( newElement.occurrence );
                    } );
                    selectedNewElementInfo.pagedOccurrencesInfo = newElementInfo.pagedOccurrencesInfo;
                    selectedNewElementInfo.parentElement = newElementInfo.parentElement;
                    selectedNewElementInfos.push( selectedNewElementInfo );
                }
            }
        } );
    }
    return selectedNewElementInfos;
};

let _getNewlyAddedChildElements = function( response, selectedNewElementInfos ) {
    // Collect the children for selected input parent.
    var newChildElements = [];
    if( selectedNewElementInfos?.length > 0 ) {
        selectedNewElementInfos.forEach( function( selectedNewElementInfo ) {
            if( selectedNewElementInfo.newElements?.length ) {
                _.forEach( selectedNewElementInfo.newElements, function( newElement ) {
                    newChildElements.push( newElement );
                } );
            }
        } );
    }
    // if the element is already present in newChildElements don't add it.
    var selectednewInfosize = newChildElements.length;
    var currentContext = appCtxService.getCtx( appCtxService.ctx.aceActiveContext?.key );
    var vmc = currentContext?.vmc;
    if( vmc ) {
        // Collect the children for other reused parent instances
        for( var j = 0; j < response.newElementInfos.length; j++ ) {
            var newElementInfo = response.newElementInfos[j];
            var parentIdx = _.findLastIndex( vmc.getLoadedViewModelObjects(), function( vmo ) {
                return vmo.uid === newElementInfo.parentElement.uid;
            } );

            var parentVMO = vmc.getViewModelObject( parentIdx );

            // If parent is expanded then only add the children
            if( parentVMO && parentVMO.isExpanded ) {
                _.forEach( newElementInfo.newElements, function( newElement ) {
                    var found = 0;
                    for( var k = 0; k < selectednewInfosize; k++ ) {
                        found = 0;
                        if( newChildElements[k].uid === newElement.occurrenceId ) {
                            found = 1;
                            break;
                        }
                    }
                    if ( found === 0 ) {
                        let modelObjects = response.ServiceData.modelObjects;
                        for( const objectKey in modelObjects ) {
                            if( modelObjects[objectKey].uid === newElement.occurrenceId ) {
                                newChildElements.push( modelObjects[objectKey] );
                            }
                        }
                    }
                } );
            }
        }
    }

    return newChildElements;
};

export let getTotalNumberOfChildrenAdded = function( response, parentElements ) {
    var totalNewElementsAdded = 0;
    var selectedNewElementInfos = response.selectedNewElementInfo ? [ response.selectedNewElementInfo ] : _prepareSelectedElementInfo( response, parentElements );
    // First get the count of all the new children for input parent.
    if( selectedNewElementInfos?.length > 0 ) {
        _.forEach( selectedNewElementInfos, function( selectedNewElementInfo ) {
            if( selectedNewElementInfo.newElements ) {
                totalNewElementsAdded += selectedNewElementInfo.newElements.length;
            }
        } );
    } else{
        // Get children count from other parent instances
        _.forEach( response.newElementInfos, function( newElementInfo ) {
            if( newElementInfo.newElements ) {
                totalNewElementsAdded += newElementInfo.newElements.length;
            }
        } );
    }
    return totalNewElementsAdded;
};

export let getAddToBookMarkInput = function( data, createdObject, sourceObjects ) {
    // New object add case
    if( createdObject ) {
        return {
            bookmark: {
                type: data.targetObjectToAdd.type,
                uid: data.targetObjectToAdd.uid
            },
            columnConfigInput: {
                clientName: '',
                fetchColumnConfig: true,
                hostingClientName: '',
                operationType: 'Union'
            },
            productsToBeAdded: [ {
                type: createdObject.type,
                uid: createdObject.uid
            } ]
        };
    } // Add one or more from palette/search
    return {
        bookmark: {
            type: data.targetObjectToAdd.type,
            uid: data.targetObjectToAdd.uid
        },
        productsToBeAdded: sourceObjects
    };
};

export let getNewlyAddedSwcProductInfo = function( data ) {
    return data.addToBookMarkResponse.addedProductsInfo[ data.addToBookMarkResponse.addedProductsInfo.length - 1 ];
};

export let getNewlyAddedSwcChildElements = function( data ) {
    return data.addToBookMarkResponse.addedProductsInfo.map( function( productInfo ) {
        return productInfo.rootElement;
    } );
};

export let getPCIOfNewlyAddedSwcProduct = function( data ) {
    return data.addToBookMarkResponse.addedProductsInfo[ data.addToBookMarkResponse.addedProductsInfo.length - 1 ].productCtxInfo;
};

/**
 * Extract allowed types from the response and return
 */
export let extractAllowedTypesInfoFromResponse = function( response, addElementState, desiredTabs ) {
    var populateAllowedTypes = {};
    var searchableTypesCount = 0;

    //Evaluate Object types for New Tab
    populateAllowedTypes.objectTypeName = response.allowedTypeInfos.filter( function( x ) {
        if( x.objectTypeName ) {
            return true;
        }
        return false;
    } ).map( function( x ) {
        return x.objectTypeName;
    } ).join();

    // Evaluate Object types for Pallet/Search Tab
    populateAllowedTypes.searchTypeName = response.allowedTypeInfos.filter( function( x ) {
        if( x.isSearchable ) {
            searchableTypesCount++;
        }
        if( x.searchTypeName ) {
            return true;
        }
        return false;
    } ).map( function( x ) {
        return x.searchTypeName;
    } ).join();

    if( response.preferredTypeInfo  && response.preferredTypeInfo !== undefined && response.preferredTypeInfo !== null ) {
        populateAllowedTypes.preferredType = response.preferredTypeInfo.objectTypeName;
    }

    var allowedClipboardObjectTypes = getAllowedClipboardObjectTypes( populateAllowedTypes.searchTypeName );

    // update visible tabs depending on types
    if( desiredTabs ) {
        populateAllowedTypes.allowedTabs = specifiedTabsToShowInAddPanel( populateAllowedTypes, searchableTypesCount,
            allowedClipboardObjectTypes, addElementState, desiredTabs );
    } else {
        populateAllowedTypes.allowedTabs = tabsToShowInAddPanel( populateAllowedTypes, searchableTypesCount,
            allowedClipboardObjectTypes, addElementState );
    }

    // we need allowedClipboardObjectTypes for palette.
    // searchTypeNames are used for both palette and search tabs
    // hence append allowedClipboardObjectTypes to the received searchTypeNames,
    if( allowedClipboardObjectTypes.length > 0 ) {
        populateAllowedTypes.searchTypeName = populateAllowedTypes.searchTypeName + ',' +
            allowedClipboardObjectTypes.join( ',' );
    }

    return populateAllowedTypes;
};

/**
 * @searchTypeName comma separated all allowed and searchable types
 * @returns array of Awb0Element types out of clipboard objects whose underlying object types are specified in
 *          searchable types
 */
function getAllowedClipboardObjectTypes( searchTypeName ) {
    var allowedClipboardObjectTypes = [];
    var clipboardObjects = clipboardService.instance.getCachableObjects();
    if( clipboardObjects.length > 0 ) {
        for( var i in clipboardObjects ) {
            if( clipboardObjects[ i ].modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) {
                var elementObject = clipboardObjects[ i ];
                if( elementObject.props.awb0UnderlyingObject &&
                    elementObject.props.awb0UnderlyingObject.dbValues[ 0 ] ) {
                    var underlyingObject = cdm
                        .getObject( elementObject.props.awb0UnderlyingObject.dbValues[ 0 ] );
                    if( searchTypeName.split( ',' ).includes( underlyingObject.type ) ) {
                        allowedClipboardObjectTypes.push( elementObject.type );
                    }
                }
            }
        }
    }
    return allowedClipboardObjectTypes;
}

/**
 * process which tabs to be shown on add element panel
 */
function tabsToShowInAddPanel( populateAllowedTypes, searchableTypesCount, allowedClipboardObjectTypes, addElementState ) {
    var tabs = [];
    if( populateAllowedTypes.objectTypeName.length > 0 ) {
        tabs.push( 'new' );
    }
    if( populateAllowedTypes.searchTypeName.length > 0 || allowedClipboardObjectTypes.length > 0 ) {
        tabs.push( 'palette' );
    }
    if( searchableTypesCount > 0 ) {
        tabs.push( 'search' );
        tabs.push( 'classification' );
    }
    if( addElementState && addElementState.allowedTabs ) {
        tabs.push( addElementState.allowedTabs );
    }
    return tabs.join();
}

/**
 * process which tabs to be shown on any panel.
 */
function specifiedTabsToShowInAddPanel( populateAllowedTypes, searchableTypesCount, allowedClipboardObjectTypes, addElementState, desiredTabs ) {
    var tabs = [];
    if( populateAllowedTypes.objectTypeName.length > 0 ) {
        if( desiredTabs.includes( 'new' ) ) {
            tabs.push( 'new' );
        }
    }
    if( populateAllowedTypes.searchTypeName.length > 0 || allowedClipboardObjectTypes.length > 0 ) {
        if( desiredTabs.includes( 'palette' ) ) {
            tabs.push( 'palette' );
        }
    }
    if( searchableTypesCount > 0 ) {
        if( desiredTabs.includes( 'search' ) ) {
            tabs.push( 'search' );
        }
        if( desiredTabs.includes( 'classification' ) ) {
            tabs.push( 'classification' );
        }
    }
    if( addElementState && addElementState.allowedTabs ) {
        tabs.push( addElementState.allowedTabs );
    }
    return tabs.join();
}

export let clearCreatedElementField = function( ) {
    return { createdObject: undefined };
};


/**
 * initializePanelProperties
 * @function initializePanelProperties
 * @param {Object}data - the view model data
 */
export let initializePanelProperties = function( data, occurrenceTypeName ) {
    //Reset subtype
    var createSubType = {};
    var vmo = {
        props: {
            type_name: {
                dbValues: [ occurrenceTypeName ]
            }
        },
        propertyDescriptors: {}
    };
    createSubType = viewModelObjectService.constructViewModelObject( vmo, false );

    //Reset number of elements
    var numberOfElements = { ...data.numberOfElements };
    numberOfElements.dbValue = 1;

    return{
        createSubType,
        numberOfElements
    };
};

export let setCreatedObjectOnState = function( createdObject, addPanelState ) {
    if( addPanelState && createdObject ) {
        let newAddPanelState = { ...addPanelState };
        if( Array.isArray( createdObject ) ) {
            newAddPanelState.createdObject = [ ...createdObject ];
        } else {
            newAddPanelState.createdObject = { ...createdObject };
        }
        return newAddPanelState;
    }
};

/**
 * Resets the createdObject property in addPanelState if it exists.
 *
 * @param {Object} addPanelState - The current state of the add panel.
 * @returns {Object} The new state with the createdObject property reset if it exists.
 */

export let resetCreatedObjectOnAddState = function( addPanelState ) {
    if( addPanelState ) {
        let newAddPanelState = { ...addPanelState };
        if( newAddPanelState.createdObject ) {
            newAddPanelState.createdObject = {};
        }
        return newAddPanelState;
    }
};

/* In tc2406, on revision of getInfoForAddElement SOA, the response field of requestPref has been changed to requestPrefMap.
 * This function is to handle the response of both the cases.
*/
let getRequestPrefMapKey = function( response ) {
    if( response.requestPrefMap ) {
        return 'requestPrefMap';
    }
    return 'requestPref';
};

export let updateAddOccurrencePropertiesOnCreate = function( response, addElementState ) {
    let newAddElementState = {};
    let requestPrefMapKey = getRequestPrefMapKey( response );
    if ( addElementState && response && response[requestPrefMapKey] && response[requestPrefMapKey].Awb0AddOccurrencePropertiesOnCreate ) {
        newAddElementState = { ...addElementState.value };
        var addOccurrencePropertiesOnCreate = response[requestPrefMapKey].Awb0AddOccurrencePropertiesOnCreate[0] === 'true';
        newAddElementState.AddOccurrencePropertiesOnCreate = addOccurrencePropertiesOnCreate;
        addElementState.update( newAddElementState );
    }
    return newAddElementState;
};

export let setStateAddElementInputParentElementToSelectedElement = function( selectedObjects, addElementState, parentToLoadAllowedTypes, filterListTitle ) {
    var newAddElementState = { ...addElementState };
    if ( selectedObjects && selectedObjects.length > 0 && newAddElementState ) {
        var parentVMO = [];
        selectedObjects.forEach( function( object ) {
            parentVMO.push( viewModelObjectService.createViewModelObject( object.uid ) );
        } );
        var parentToLoadAllowedTypesVMO = parentToLoadAllowedTypes ? viewModelObjectService.createViewModelObject( parentToLoadAllowedTypes ) : null;
        if ( newAddElementState.parentElements ) {
            newAddElementState.parents = parentVMO;
            newAddElementState.parentElements = parentVMO;
            newAddElementState.siblingElements = [];
        }else{
            newAddElementState.parent = parentVMO[0];
            newAddElementState.parentElement = parentVMO[0];
            newAddElementState.siblingElement = {};
        }

        newAddElementState.parentToLoadAllowedTypes = parentToLoadAllowedTypesVMO ? parentToLoadAllowedTypesVMO : _.last( parentVMO );
        newAddElementState.areNumberOfElementsInRange = true;
        newAddElementState.filterListTitle = filterListTitle;
    }
    return newAddElementState;
};

export let updateStateForAceAddSiblingPanel = function( selectedObjects, addElementState ) {
    var selectionObjects = selectedObjects?.length > 0 ? selectedObjects : appCtxService.ctx.selected;
    var newAddElementState = { ...addElementState };
    if ( selectionObjects?.length > 0 && newAddElementState ) {
        var parentVMOs = [];
        var selectionVMOs = [];
        selectionObjects.forEach( function( object ) {
            var selectionVMO = viewModelObjectService.createViewModelObject( object.uid );
            var parentUid = selectionVMO.props.awb0Parent?.dbValues[0];
            if( parentUid ) {
                parentVMOs.push( viewModelObjectService.createViewModelObject( parentUid ) );
                selectionVMOs.push( selectionVMO );
            }
        } );
        if ( newAddElementState.parentElements ) {
            newAddElementState.parents = parentVMOs;
            newAddElementState.parentElements = parentVMOs;
            newAddElementState.siblingElements = selectionVMOs;
        }else{
            newAddElementState.parent = parentVMOs[0];
            newAddElementState.parentElement = parentVMOs[0];
            newAddElementState.siblingElement = selectionVMOs[0];
        }
        newAddElementState.parentToLoadAllowedTypes = _.last( parentVMOs );
        newAddElementState.areNumberOfElementsInRange = true;
    }
    return newAddElementState;
};

export let updateStateAddElement = function( subPanelContext ) {
    var newAddElementState = { ...subPanelContext.addElementState.value };
    newAddElementState.previousSelectionUid = subPanelContext?.occContext?.pwaSelection?.length > 0 && _.last( subPanelContext?.occContext?.pwaSelection ).uid;
    newAddElementState.isCopyButtonEnabled = !occurrenceManagementStateHandler.isFeatureSupported( 'HideAddCopyButtonFeature_32' );
    if ( occmgmtUtils.isTreeView() ) {
        newAddElementState.fetchPagedOccurrences = true;
    }
    subPanelContext.addElementState.update( newAddElementState );
    eventBus.publish( 'addElement.getInfoForAddElementAction' );
};

export let buildElementCreateInputAndUpdateState = function( data, subPanelContext ) {
    var newAddElementState = { ...subPanelContext.addElementState.value };
    var editHandler = data.editHandlers.addPanelEditHandler;
    let createSubType = {
        props: {
            type_name: {
                dbValues: [ subPanelContext.addElementState.occurrenceTypeName ]
            }
        },
        propertyDescriptors: {}
    };
    let createData = [];
    let numberOfObjects = 1;
    if( subPanelContext.addPanelState?.sourceObjects?.length > 1 ) {
        numberOfObjects = subPanelContext.addPanelState.sourceObjects.length;
    }
    for( let object = 1; object <= numberOfObjects; object++ ) {
        var elementCreateInput = addObjectUtils.getCreateInput( data, newAddElementState.extensionVMProps, createSubType, editHandler );
        if( elementCreateInput[0].createData.propertyNameValues && elementCreateInput[0].createData.propertyNameValues.qty_value &&
            elementCreateInput[0].createData.propertyNameValues.qty_value[0] === '0' ) {
            elementCreateInput[0].createData.propertyNameValues.qty_value[0] = '';
        }
        createData.push( elementCreateInput[0].createData );
    }

    newAddElementState.elementCreateInput = elementCreateInput;
    newAddElementState.elementCreateData = createData;
    newAddElementState.numberOfElements = data.numberOfElements;
    subPanelContext.addElementState.update( newAddElementState );
};

export let getPciForParentSelection = function( subPanelContext ) {
    if( subPanelContext.addElementState.parents?.length > 0 ) {
        return cdm.getObject( occmgmtUtils.getProductContextForProvidedObject( subPanelContext.addElementState.parents[0], subPanelContext.occContext ) );
    } else if( subPanelContext.addElementState.parent ) {
        return cdm.getObject( occmgmtUtils.getProductContextForProvidedObject( subPanelContext.addElementState.parent, subPanelContext.occContext ) );
    }

    return subPanelContext.occContext.productContextInfo;
};

export let updateSaveAsContext = function( selectedObj ) {
    var deferred = AwPromiseService.instance.defer();
    cfgSvc.getCfg( 'saveAsRevise' ).then( function( saveAsRevise ) {
        var selectedObjs = [];
        selectedObjs.push( selectedObj );
        var adaptedObjsPromise = adapterSvc.getAdaptedObjects( selectedObjs );
        adaptedObjsPromise.then( function( adaptedObjs ) {
            var context;
            adaptedObjs[ 0 ].modelType.typeHierarchyArray.forEach( function( element ) {
                if( saveAsRevise[ element ] ) {
                    context = saveAsRevise[ element ];
                }
            } );
            if( context ) {
                context.SelectedObjects = [ adaptedObjs[ 0 ] ];
            } else {
                context = {
                    SelectedObjects: [ adaptedObjs[ 0 ] ]
                };
            }
            deferred.resolve( {
                saveAsContext: context
            } );
        } );
    } );

    return deferred.promise;
};

export let getRequestPrefValue = function( occContext, targetObject ) {
    let requestPref = {};

    _.forEach( occContext?.persistentRequestPref, function( value, name ) {
        if( !_.isUndefined( value ) ) {
            requestPref[ name ] = [ value.toString() ];
        }
    } );

    requestPref.displayMode = [ 'Tree' ];
    if ( requestPref.structExpanded === undefined ) {
        var val = getExpandedValue( occContext, targetObject );
        requestPref.structExpanded = [ val ];
    }

    return requestPref;
};

export let assignInitialValuesToXrtProperties = function( createType, editHandler ) {
    if( editHandler ) {
        let dataSource = editHandler.getDataSource();
        if( dataSource ) {
            let viewModelProps = [];
            let editableViewModelProperties = dataSource.getAllEditableProperties();
            _.forEach( editableViewModelProperties, function( vmProp ) {
                if( vmProp.propertyName ===  'qty_value' ) {
                    viewModelProps.push( {
                        propertyName: vmProp.propertyName,
                        dbValue: ''
                    } );
                }
            } );
            addObjectUtils.assignInitialValues( viewModelProps, createType, editHandler );
        }
    }
};

export let buildInputForUpdateQuantityForSplit = function( ctx ) {
    var inputs = [];
    var modifiedProperties = [];

    var obj = {
        type: ctx.selected.type,
        uid: ctx.selected.uid
    };

    let date = new Date();
    let dateValue = dateTimeSvc.formatUTC( date );

    var modifiedProperty = {
        propertyName: 'awb0Quantity',
        dbValues: [],
        uiValues: [],
        intermediateObjectUids: [],
        isModifiable: true,
        srcObjLsd: dateValue
    };

    modifiedProperties.push( modifiedProperty );
    var input = {
        obj: obj,
        viewModelProperties: modifiedProperties,
        isPessimisticLock: false,
        workflowData: {}
    };

    inputs.push( input );
    return inputs;
};

/**
 * Function to get the occurrence property section name of component.
 *
 * @internal
 * @param {object} addElementState addElementState
 * @return {String} section name
 */
export let getOccurrencePropertySectionName = function(  addElementState ) {
    let aceI18nResourceBundle = localeService.getLoadedText( _OCCMGMTCONSTANTS );
    return addElementState?.occurrenceTypeName === _PSOCCURRENCE ? aceI18nResourceBundle.elementProperties : aceI18nResourceBundle.usageProperties;
};

export let updateResponseOnAddElementState = ( response, addElementState ) => {
    let newAddElementState = { ...addElementState.value };
    newAddElementState.allowedPSOccurrenceTypes = response.allowedPSOccurrenceTypes;
    addElementState.update( newAddElementState );
};
/**
 * populate the extension properties for createData of createAttachAndSubmitObjects SOA.
 *
 * @internal
 * @param {Object} rootElement  -  Root Element in AW
 * @param {Object} selectedObjectTypeInPanel - Selected Type in the type section
 * @return {Object} vmp of for extensionVMProps
 */
export let populateExtensionProps = function( rootElement, selectedObjectTypeInPanel ) {
    if( selectedObjectTypeInPanel ) {
        let extensionVMProps = {};
        let selectedObjectType  = cmm.getType( selectedObjectTypeInPanel.props.type_name.dbValues[0] );
        if( selectedObjectType && selectedObjectType.typeHierarchyArray.indexOf( _FND0COORDINATESYSTEMTYPE ) > -1 ) {
            let openProductItem = cdm.getObject( rootElement.props.awb0UnderlyingObject.dbValues[0] );
            extensionVMProps.fnd0ProductItem = _uwPropSrv.createViewModelProperty( _FND0PRODUCTITEM, '', 'OBJECT', openProductItem.props.items_tag.dbValues[ 0 ],
                openProductItem.props.items_tag.uiValues );
            extensionVMProps.fnd0ProductItem.valueUpdated = true;
        }
        return {
            extensionVMProps: extensionVMProps
        };
    }
};

export const unregisterRevisionRuleContext = function( panelName ) {
    if( panelName !== 'RevisionRuleAdminMainPanel' ) {
        appCtxService.unRegisterCtx( 'RevisionRuleAdmin' );
    }
};

/**
 * Function to prepare the list of AddObjectParentChildrenData needed for addObject SOA input
 * @param {Object} addElementState Add element state
 * @param {Object} addPanelState The current state of the add panel.
 * @param {Object} occContext occContext, ACE atomic data
 * @param {boolean} shouldAddCreateInput add element with/without CreateInput
 * @return {Array} List of addObjectParentChildrenData
 */
export let prepareAddObjectInput = function( addElementState, addPanelState, occContext, shouldAddCreateInput ) {
    let addObjectParentChildrenList = [];
    let selectedParentElements = addElementState.parentElements;

    for( var i = 0; i < selectedParentElements.length; i++ ) {
        let addObjectParentChildrenData = {};
        let parentElement = selectedParentElements[i];
        if( parentElement ) {
            addObjectParentChildrenData.parentElement = parentElement;
            addObjectParentChildrenData.siblingElement = addElementState.siblingElements.length > 0 ? addElementState.siblingElements[i] : {};
            addObjectParentChildrenData.actualParent = addElementState.sourceParent;
            addObjectParentChildrenData.productContext = cdm.getObject( occmgmtUtils.getProductContextForProvidedObject( parentElement, occContext ) );

            //Set the expansion state of parent element
            let isExpanded = getExpandedValue( occContext, parentElement, addElementState.fetchOccurrenceTypesFor );
            if( isExpanded === 'true' ) {
                addObjectParentChildrenData.structExpanded = true;
            }else{
                addObjectParentChildrenData.structExpanded = false;
            }

            //Create the input for each parent
            let objectsToAddList = [];
            let objectsToAdd = getElementsToAdd( addPanelState.createdObject, addPanelState.sourceObjects );
            for( let obj = 0; obj < objectsToAdd.length; obj++ ) {
                let objectToAddInfo = {};
                if( shouldAddCreateInput ) {
                    objectToAddInfo.createInput = addElementState.elementCreateData[obj];
                } else{
                    objectToAddInfo.createInput = { boName:' ', propertyNameValues:{}, compoundCreateInput:{} };
                }
                objectToAddInfo.objectToAdd = objectsToAdd[obj];
                objectsToAddList.push( objectToAddInfo );
            }
            addObjectParentChildrenData.objectsToAddList = objectsToAddList;
            addObjectParentChildrenList.push( addObjectParentChildrenData );
        }
    }

    return addObjectParentChildrenList;
};

/**
 * Add Element service
 */

export default exports = {
    getDisplayMode,
    getSeperateQuantityAndPrepareAddInput,
    setCtxAddElementInputParentElementToSelectedElement,
    updateCtxForAceAddSiblingPanel,
    processAddElementInput,
    populateRequestPref,
    getElementsToAdd,
    getElementsToReplace,
    getProductContextInfos,
    getReplacedElementsUids,
    setOperation,
    setReplaceMode,
    resetNumberOfElements,
    getNumberOfElements,
    setUnderlyingObjectsOfSourceObjectsAndReturn,
    createSaveAsInput,
    getTotalNumberOfChildrenAdded,
    getAddToBookMarkInput,
    getNewlyAddedSwcProductInfo,
    getNewlyAddedSwcChildElements,
    extractAllowedTypesInfoFromResponse,
    clearCreatedElementField,
    initializePanelProperties,
    setCreatedObjectOnState,
    updateAddOccurrencePropertiesOnCreate,
    getExpandedValue,
    setStateAddElementInputParentElementToSelectedElement,
    updateStateForAceAddSiblingPanel,
    updateStateAddElement,
    buildElementCreateInputAndUpdateState,
    getPciForParentSelection,
    updateSaveAsContext,
    getRequestPrefValue,
    assignInitialValuesToXrtProperties,
    getElementTobeReplaced,
    getPCIOfNewlyAddedSwcProduct,
    getAddElementResponse,
    buildInputForUpdateQuantityForSplit,
    getOccurrencePropertySectionName,
    populateExtensionProps,
    updateResponseOnAddElementState,
    resetCreatedObjectOnAddState,
    unregisterRevisionRuleContext,
    prepareAddObjectInput
};
