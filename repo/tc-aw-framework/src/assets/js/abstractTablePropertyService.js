import _ from 'lodash';
import appCtxService from 'js/appCtxService';
import browserUtils from 'js/browserUtils';
import cdm from 'soa/kernel/clientDataModel';
import cmm from 'soa/kernel/clientMetaModel';
import eventBus from 'js/eventBus';
import viewModelObjectService from 'js/viewModelObjectService';
import soaSvc from 'soa/kernel/soaService';
import xrtTableSvc from 'js/xrtTableHeightService';
import editHandlerService from 'js/editHandlerService';
import propertyPolicySvc from 'soa/kernel/propertyPolicyService';
import { isObjectSetSourceDCP, initDataProviderRef } from 'js/xrtUtilities';

let exports = {};

/*
 * Generates a unique Dynamic view model for Table Property or Name Value Pair element
 * @param {String} uniqueName Unique Name to use for tableprop/nameValue
 * @param {String} objectSetSource The Object Set Source/Source of the TableProp/NameValue
 * @param {String} parentUid The parent UID
 * @param {Object[]} columns The Columns for the table
 * @param {String[]} firstPageUids The first page UIDs
 * @param {Object[]} objects The objects passed from server
 * @returns {Object} Table Property or Name Value View Model
 */
export const createDynamicTablePropertyViewModel = function( uniqueName, objectSetSource, parentUid, columns, firstPageUids, objects, editContextKey,
    selectionData, operationName, sortCriteria, enablePropEdit ) {
    const dpName = `${uniqueName}_Provider`;
    const cpName = `${uniqueName}_ColumnProvider`;

    const searchResultsName = `${dpName}_searchResults`;
    const totalFoundName = `${dpName}_totalFound`;

    const editContextKeyIn = editContextKey ? editContextKey : 'NONE';

    const viewModel = {
        schemaVersion: '1.0.0',
        actions: {
            updateCtxFromObject: {
                actionType: 'JSFunction',
                method: 'updateCtxFromObject',
                inputData: {
                    ctxObj: '{{data._ctx}}'
                },
                deps: 'js/appCtxService'
            }
        },
        columnProviders: {},
        data: {
            objects: objects,
            operationName
        },
        dataProviders: {},
        functions: {
            getActiveWorkspaceXrtContext: {
                functionName: 'getActiveWorkspaceXrtContext',
                parameters: [ '{{ctx.ActiveWorkspace:xrtContext}}' ]
            }
        },
        grids: {},
        i18n: {},
        messages: {},
        onEvent: [ {
            eventId: 'awXRT2.contentLoaded',
            action: 'updateCtxFromObject'
        } ]
    };

    /* Start actions */

    // get filter facet values
    viewModel.actions[ `${dpName}_getFilterFacetValues` ] = {
        actionType: 'TcSoaService',
        serviceName: 'Internal-AWS2-2019-12-Finder',
        method: 'getFilterValues',
        inputData: {
            filterFacetInput: {
                columnFilters: '{{filterFacetInput.columnFilters}}',
                columnName: '{{filterFacetInput.column.field}}',
                maxToReturn: 50,
                providerName: 'Awp0ObjectSetRowProvider',
                searchCriteria: {
                    'ActiveWorkspace:xrtContext': '{{function:getActiveWorkspaceXrtContext}}',
                    objectSet: `${objectSetSource}.Fnd0TableRow`, // TODO: Verify this
                    parentUid: parentUid
                },
                startIndex: '{{filterFacetInput.startIndex}}'
            }
        },
        outputData: {
            filterFacetResults: '{{json:facetValues}}'
        },
        deps: 'js/xrtUtilities'
    };

    // load data action
    const loadDataAction = {
        actionType: 'JSFunctionAsync',
        method: 'basePerformSearchViewModel',
        deps: 'js/tcDataManagementService',
        inputData: {
            0: {
                inflateProperties: true,
                searchInput: {
                    columnFilters: `{{data.columnProviders.${cpName}.columnFilters}}`,
                    maxToLoad: 50,
                    maxToReturn: 50,
                    providerName: 'Awp0TablePropertyProvider',
                    searchCriteria: {
                        objectSet: objectSetSource,
                        parentUid: parentUid
                    },
                    searchSortCriteria: `{{data.columnProviders.${cpName}.sortCriteria}}`,
                    startIndex: `{{data.dataProviders.${dpName}.startIndex}}`
                }
            }
        },
        outputData: {}
    };
    loadDataAction.outputData[ searchResultsName ] = '{{json:searchResultsJSON}}';
    loadDataAction.outputData[ totalFoundName ] = 'totalFound';
    viewModel.actions[ `${dpName}_loadData` ] = loadDataAction;

    /* End Actions */
    // DataProvider
    viewModel.dataProviders[ dpName ] = {
        action: `${dpName}_loadData`,
        commandsAnchor: 'com.siemens.splm.clientfx.ui.modelObjectDataGridActionCommands',
        filterFacetAction: `${dpName}_getFilterFacetValues`,
        filterFacetResults: '{{data.filterFacetResults}}',
        editContext: editContextKeyIn,
        enablePropEdit: enablePropEdit,
        firstPage: firstPageUids,
        isObjectSetSourceDCP: isObjectSetSourceDCP( objectSetSource ),
        response: `{{data.${searchResultsName}}}`,
        selectionModelMode: 'multiple',
        totalFound: `{{data.${totalFoundName}}}`,
        inputData: {
            selectionData: selectionData
        }
    };

    // Column Provider
    viewModel.columnProviders[ cpName ] = {
        columns: columns,
        sortCriteria: [ sortCriteria ]
    };

    // Grid
    viewModel.grids[ dpName ] = {
        addIconColumn: false,
        columnProvider: cpName,
        dataProvider: dpName,
        gridOptions: {
            enableGridMenu: true,
            enableSorting: true,
            isFilteringEnabled: true
        }
    };

    return viewModel;
};

/**
 * Sets the property data and type on the view model for later use
 *
 * @param {Object} viewModel - the view model
 * @param {Object} propertyData The property data
 * @param {String} propertyType string. Example NameValue or TableProperty
 */
export const setPropertyData = function( viewModel, propertyData, propertyType ) {
    viewModel.data._propertyData = propertyData;
    viewModel.data._propertyData.initialRowDataInput = propertyData.id + '_InitialRowDataInput';
    viewModel.data._propertyType = propertyType;
};

/**
 * Returns the property data
 *
 * @param {Object} viewModel - the view model
 * @return {Object} property data
 */
export const getPropertyData = function( viewModel ) {
    return viewModel.data._propertyData;
};

/**
 * Returns the property type
 *
 * @param {Object} viewModel - The view model
 * @returns {Object} property type
 */
export const getPropertyType = function( viewModel ) {
    return viewModel.data._propertyType;
};

export const processInitialDataProvider = ( viewModel, dpRef ) => {
    const { dataProviders } = viewModel;
    let dataProvider = dataProviders[ viewModel.data.providerName ];
    if( viewModel.data._propertyData && viewModel.data._propertyData.id ) {
        viewModel.data.gridId = viewModel.data._propertyData.id + '_Provider';
    }

    if( dataProvider && dataProvider.json && dataProvider.json.firstPage && !_.isEmpty( dataProvider.json.firstPage ) ) {
        let firstPageObjs = [];
        _.forEach( dataProvider.json.firstPage, function( uid ) {
            const vmo = viewModel.objects[ uid ];
            if( vmo ) {
                firstPageObjs.push( vmo );
            }
        } );

        if( firstPageObjs.length > 0 ) {
            dataProvider.vmCollectionDispatcher( {
                type: 'COLLECTION_UPDATE',
                viewModelObjects: firstPageObjs,
                totalFound: firstPageObjs.length,
                cursorObject: dataProvider.cursorObject,
                pageObject: {}
            } );
        }
    }

    // register dataprovider/objectsetsource with xrt
    let tablePropertyNameValueSource = viewModel.data._propertyData && viewModel.data._propertyData.propertyName;
    if( dataProvider && tablePropertyNameValueSource ) {
        dataProvider.setValidSourceTypes( tablePropertyNameValueSource );
    }

    initDataProviderRef( dpRef );
    dpRef.current.dataProviders.push( dataProvider.viewModelCollection.getLoadedViewModelObjects );
};

/**
 * Initializes ctx needed for table prop/name value to work
 *
 * @param {Object} viewModel the view model
 * @param {Function} specificContextInit Context initialization function specific for table prop or name value
 */
export const initContext = function( viewModel, specificContextInit ) {
    const propData = exports.getPropertyData( viewModel );
    let owningObjectUid = propData.parentUid;
    let tablePropertyName = propData.propertyName;
    appCtxService.registerCtx( propData.initialRowDataInput, {
        owningObject: {
            uid: owningObjectUid
        },
        tablePropertyName: tablePropertyName
    } );

    if( specificContextInit ) {
        specificContextInit( viewModel );
    }

    let additionalProps = {
        tablePropertyName: tablePropertyName,
        owningObject: owningObjectUid
    };

    let existingAdditionalProps = appCtxService.getCtx( 'InitialSaveDataAdditionalProps' );
    existingAdditionalProps = existingAdditionalProps ? existingAdditionalProps : {};
    existingAdditionalProps[ tablePropertyName ] = additionalProps;
    appCtxService.registerCtx( 'InitialSaveDataAdditionalProps', existingAdditionalProps );

    let parentVmo = cdm.getObject( propData.parentUid );
    if( parentVmo ) {
        let parentVmoType = cmm.getType( parentVmo.type );
        if( parentVmoType && parentVmoType.propertyDescriptorsMap ) {
            let prop = parentVmoType.propertyDescriptorsMap[ propData.propertyName ];

            propData.displayName = prop.displayName;
            propData.propertyRefType = prop.constantsMap.ReferencedTypeName;
            let parentVMOIsModifiable = true; // The default is_modifiable should be true unless server returns it as false.
            if( parseInt( parentVmo?.props?.is_modifiable?.dbValues[ 0 ] ) === 0 ) {
                parentVMOIsModifiable = false;
            }
            propData.isPropertyModifiable = prop.constantsMap.modifiable && parentVMOIsModifiable;

            // PropertyConstantsMap from platform always sends editable as 1 when enabled property constant is true. when it is false, it will not send that flag at all.
            // We need to disable add, remove and duplicate when enabled constant is false.
            // Duplicate command also checks for createCommandEnabled too, so it will also be disabled when enabled constant is false.
            propData.createCommandEnabled = propData.isPropertyModifiable && Boolean( prop.constantsMap.editable );
            propData.removeCommandEnabled = Boolean( prop.constantsMap.editable );
            viewModel.data._propertyData = propData;
        }
    }
    viewModel.dispatch( { path: 'data', value: { ...viewModel.data } } );
    _setTableHeightAndWidthInternal( viewModel, true );
};

/**
 * Set tableProperty height and width
 * @param {Object} viewModel - the view model
 * @param {Boolean} skipDispatch -skip dispatch update
 */
function _setTableHeightAndWidthInternal( viewModel, skipDispatch ) {
    let newHeight;
    const propData = exports.getPropertyData( viewModel );
    newHeight = xrtTableSvc.calculateTableHeight( propData );

    viewModel.data.tableWidth = browserUtils.isIE ? 'calc(100% - 10px)' : '100%';
    if( viewModel.data.tableHeight !== newHeight ) {
        viewModel.data.tableHeight = newHeight;
        eventBus.publish( viewModel.data.providerName + '.plTable.containerHeightUpdated', viewModel.data.tableHeight );
        if( !skipDispatch ) {
            viewModel.dispatch( { path: 'data', value: { ...viewModel.data } } );
        }
    }
}

/**
 * Processes grid selection event by updating the selection on the application context
 * qualifying it using the property type
 *
 * @param {Object} eventData holding selected objects from the grid
 * @param {Object} viewModel - the view model
 */
export const processGridSelectionEvent = function( eventData, viewModel ) {
    const { selectedObjects, dataProvider, dataProviderName } = eventData;
    const propData = exports.getPropertyData( viewModel );
    const propType = exports.getPropertyType( viewModel );
    propData.removeCommandEnabled = false;
    if( dataProvider && selectedObjects && selectedObjects.length > 0 ) {
        const viewModelCollection = dataProvider.viewModelCollection;
        if( viewModelCollection && viewModelCollection.getLoadedViewModelObjects().indexOf( selectedObjects[ 0 ] ) > -1 ) {
            // When Enabled property constant is false for the table prop or name value pair, create will be disabled.
            // When there is an existing data already in table, if the enabled is made false, then remove should also be disabled.
            propData.removeCommandEnabled = propData.isPropertyModifiable && propData.createCommandEnabled;
            exports.setPropertyData( viewModel, propData, propType );
            viewModel.dispatch( { path: 'data._propertyData', value: propData } );
        }
    }
    let selectionData = appCtxService.getCtx( `${propType}Selection` ) || {};
    selectionData[ dataProviderName ] = {
        selectedObjects: selectedObjects
    };
    appCtxService.registerCtx( propType + 'Selection', selectionData );
    // Set active tableproperty/namevalue
    appCtxService.registerCtx( 'ActiveTablePropertyId', dataProviderName );
};

/**
 * Processes the cdm created event to map initial dummy row of table property and name value to
 * actual persistent object returned by the server or refresh the grid on successful deletion of
 * a persistent table row
 *
 * @param {Object} data holding updated or modified objects array
 * @param {Object} viewModel - the view model
 */
export const processCdmCreatedEvent = function( data, viewModel ) {
    if( viewModel.data._syncFromCdm ) {
        var activeEditHandler = editHandlerService.getActiveEditHandler();
        if( activeEditHandler && viewModel.data.preSaveActionID ) {
            activeEditHandler.unregisterPreSaveAction( viewModel.data.preSaveActionID );
            delete viewModel.data.preSaveActionID;
        }
        const propData = exports.getPropertyData( viewModel );
        let createdObjects = data.newObjects || data.createdObjects || [];
        let owningTable = cdm.getObject( propData.parentUid );
        if( owningTable ) {
            const ownedUids = owningTable.props[ propData.propertyName ].dbValues;

            createdObjects = createdObjects.filter( function( obj ) {
                return ownedUids.indexOf( obj.uid ) > -1;
            } );
        }
        let createdVmos = {
            viewModelObjects: []
        };

        createdObjects.forEach( function( currentUpdatedObject ) {
            let updatedVmo = viewModelObjectService.createViewModelObject( currentUpdatedObject, 'EDIT' );

            if( updatedVmo &&
                cmm.isInstanceOf( propData.propertyRefType, updatedVmo.modelType ) ) {
                createdVmos.viewModelObjects.push( updatedVmo );
            }
        } );

        const dataProvider = viewModel.dataProviders[ viewModel.data.providerName ];
        let viewModelCollection = dataProvider.viewModelCollection;
        let loadedVMObjs = viewModelCollection.getLoadedViewModelObjects();

        // Remove dummy vmo information if there is any in the viewModelCollection.
        // This dummy vmo will be created when you delete rows which will be sent for save SOA.
        if( loadedVMObjs?.length > 0 ) {
            let cleanVMObjs = [];
            for( let i = 0; i < loadedVMObjs.length; i++ ) {
                if( !loadedVMObjs[i].uid.includes( cdm.NULL_UID ) ) {
                    cleanVMObjs.push( loadedVMObjs[i] );
                }
            }
            viewModelCollection.setViewModelObjects( cleanVMObjs );
        }

        // if persistentVMOs are empty and created VMOs are not empty, just assign them directly to _persistentVMOs.
        if( createdVmos.viewModelObjects.length > 0 ) {
            if( viewModel.data._persistentVMOs === null || viewModel.data._persistentVMOs === undefined ) {
                viewModel.data._persistentVMOs = createdVmos.viewModelObjects;
            } else {
                // Compare persistentVMOs with created VMOs and insert the new ones that are not in persistentVMOs.
                _.forEach( createdVmos.viewModelObjects, function( createdVmo ) {
                    if( viewModel.data._persistentVMOs ) {
                        const newVMOForPersistentVMOs = viewModel.data._persistentVMOs.find( ( { uid } ) => uid === createdVmo.uid );
                        if( newVMOForPersistentVMOs === undefined ) {
                            viewModel.data._persistentVMOs.push( createdVmo );
                        }
                    }
                } );

                // Merge the persistentVMOs with created objects if there are any.
                if( viewModel.data._persistentVMOs && viewModel.data._persistentVMOs.length > 0 && createdVmos.viewModelObjects.length > 0 ) {
                    viewModel.data._persistentVMOs = viewModel.data._persistentVMOs.map( x => createdVmos.viewModelObjects.find( ( { uid } ) => uid === x.uid ) || x );
                }
            }
        }

        if( viewModel.data._persistentVMOs && viewModel.data._persistentVMOs.length > 0 ) {
            const updatedAndRemainingVMOs = _.filter( viewModel.data._persistentVMOs, function( vmo ) {
                return !_.includes( viewModel.data._removedVMOUids, vmo.uid );
            } );
            dataProvider.update( updatedAndRemainingVMOs, updatedAndRemainingVMOs.length );

            // Do not include dummy vmo information in the objectsToBeRestored.
            // This objectsToBeRestored will be used for cancel edit operation.
            let objectsToBeRestored = []; // clean up ObjectsToBeRestored array.
            _.forEach( viewModel.data._persistentVMOs, function( vmo ) {
                if( !vmo.uid.includes( cdm.NULL_UID ) ) {
                    objectsToBeRestored.push( vmo );
                }
            } );
            viewModel.data.objectsToBeRestored = objectsToBeRestored;
        }

        viewModel.data._syncFromCdm = false;
        viewModel.dispatch( { path: 'data', value: { ...viewModel.data } } );
        eventBus.publish( `${viewModel.data.providerName}.plTable.clientRefresh` );
    }
};

/**
 * Adds given property to props array. This is helper method used for setting additional context
 * object and property name on table property objects
 *
 * @param {String} propertyName - property name
 * @param {String} propertyValue - value of the property
 * @param {String} parentUid - uid of the parent i.e. owning object
 * @param {ObjectArray} props - array of properties to which new properties need to be added
 * @param {String} alternateID - alternateID of the parent i.e. owning object
 */
export const addProperty = function( propertyName, propertyValue, parentUid, props, alternateID ) {
    props[ propertyName ] = {
        dbValue: propertyValue,
        uiValue: propertyValue,
        dbValues: [ propertyValue ],
        uiValues: [ propertyValue ],
        newDisplayValues: [ propertyValue ],
        displayValues: [ propertyValue ],
        modifiable: true,
        editable: true,
        isEditable: true,
        propertyName: propertyName,
        propertyDescriptor: [],
        displayValueUpdated: true,
        parentUid: parentUid,
        alternateID: alternateID
    };
};

export const addContextObjectAndProperty = function( data, vmo, operation ) {
    if( vmo && vmo.modelType ) {
        if( !cmm.isInstanceOf( 'Fnd0NameValue', vmo.modelType ) &&
            !cmm.isInstanceOf( 'Fnd0TableRow', vmo.modelType ) ) {
            return;
        }

        if( vmo.props ) {
            exports.addProperty( 'owningObject', data.parentUid, vmo.uid, vmo.props, vmo.alternateID );
            exports.addProperty( 'tablePropertyName', data.propertyName, vmo.uid, vmo.props, vmo.alternateID );

            if( operation === 'add' ) {
                exports.addProperty( 'newRowTypeName', vmo.type, vmo.uid, vmo.props, vmo.alternateID );
                exports.addProperty( 'operation', 'add', vmo.uid, vmo.props, vmo.alternateID );

                // in case of name value, the data is set on panel and then transferred to the grid as initial row
                // in case of table prop, the data is directly set on the newly added dummy row in the grid
                // thus, display values updated need to be set only for name value i.e. cases where the data is getting
                // set from a panel and then transferred to the grid.
                if( data.setDisplayValuesUpdated ) {
                    _.forEach( vmo.props, function( prop ) {
                        prop.displayValueUpdated = true;
                    } );
                }
            } else if( operation === 'remove' ) {
                exports.addProperty( 'operation', 'remove', vmo.uid, vmo.props, vmo.alternateID );
            }
        }
    }
};

export const updateVmoData = function( viewModel ) {
    if( viewModel && viewModel.data.objects ) {
        let newViewModelObjs = {};
        // viewModel.objects is a map of uid versus ViewModelObject
        _.forEach( viewModel.data.objects, function( object, uid ) {
            if( object.modelType && !cmm.isInstanceOf( 'Fnd0TableRow', object.modelType ) ) {
                newViewModelObjs[ uid ] = object;
            }
        } );
        viewModel.data.objects = newViewModelObjs;
        viewModel.dispatch( { path: 'data.objects', value: newViewModelObjs } );
    }

    if( viewModel.data.vmo && viewModel.data.vmo.modelType ) {
        let vmo = viewModel.data.vmo;
        const propData = exports.getPropertyData( viewModel );
        if( cmm.isInstanceOf( 'Fnd0TableRow', vmo.modelType ) ) {
            exports.addContextObjectAndProperty( propData, vmo, 'edit' );
            viewModel.dispatch( { path: 'data.vmo', value: vmo } );
        }
    }
};

/**
 * Updates the grid with dummy row data as provided by the server
 *
 * @param {Object} viewModel - the view model
 * @param {ObjectArray} initialTableRowData array holding name and value of property
 * @param {ObjectArray} initialVMOs array of objects currently in the grid
 * @param {Object} modelType holding property descriptions map as available from cmm
 * @param {Object} modelObject - parent model object
 * @param {String} dummyUid string for initial table row before it is persisted to database
 * @param {Boolean} setValueUpdated if the prop should be set as if the value has been updated - useful for duplicating rows
 */
export const updateGridWithInitialRow = function( viewModel, initialTableRowData, initialVMOs, modelType,
    modelObject, dummyUid, setValueUpdated ) {
    const propData = exports.getPropertyData( viewModel );
    let updatedVMOs = {
        viewModelObjects: initialVMOs
    };

    // Loop through and set the default values
    // Only set uiValue and dbValue if provided (cases such as duplicate)
    if( initialTableRowData && Array.isArray( initialTableRowData ) ) {
        for( const element of initialTableRowData ) {
            const propName = element.name;
            const dbValue = element.dbValue;
            const dbValues = element.dbValues;
            const uiValue = element.uiValue;
            const uiValues = element.uiValues;
            let prop = {};
            prop.propertyDescriptor = modelType.propertyDescriptorsMap[ propName ];
            prop.dbValues = dbValues;
            prop.uiValues = uiValues;
            if( dbValue ) {
                prop.dbValue = dbValue;
            }
            if( uiValue ) {
                prop.uiValue = uiValue;
            }
            prop.displayValues = uiValues;
            prop.newDisplayValues = uiValues;
            prop.modifiable = true;
            prop.editable = true;
            prop.isEditable = true;
            prop.isPropertyModifiable = true;
            prop.parentUid = cdm.NULL_UID;
            prop.alternateID = dummyUid;
            prop.srcObjLsd = '2017-09-01T14:34:12+05:30';
            modelObject.props[ propName ] = prop;
        }
    }

    let initialRowVM = viewModelObjectService.constructViewModelObjectFromModelObject( modelObject, 'CREATE' );
    initialRowVM.uid = cdm.NULL_UID;
    initialRowVM.alternateID = dummyUid;

    // If duplicating row, set all props with values to have valueUpdated true so they get saved.
    // must be done after VMO is created
    if( setValueUpdated ) {
        _.forEach( initialRowVM.props, function( prop ) {
            if( !_.isNil( prop.dbValue ) && prop.dbValue !== '' && ( prop.type !== 'DATE' || prop.uiValue !== '' ) ) {
                prop.valueUpdated = true;
                prop.newValue = prop.dbValue;
            }
        } );
    }

    exports.addContextObjectAndProperty( propData, initialRowVM, 'add' );

    updatedVMOs.viewModelObjects.push( initialRowVM );

    exports.updateVmoData( viewModel );

    const dataProvider = viewModel.dataProviders[ viewModel.data.providerName ];
    dataProvider.update( updatedVMOs.viewModelObjects, updatedVMOs.viewModelObjects.length );
    if( dataProvider && dataProvider.json && dataProvider.json.firstPage ) {
        delete dataProvider.json.firstPage;
    }

    eventBus.publish( viewModel.data.providerName + '.plTable.clientRefresh' );
    viewModel.data._syncFromCdm = true;
    viewModel.dispatch( { path: 'data._syncFromCdm', value: true } );

    // register property policy for this table property/name value pair if not already registered
    if( !viewModel.data.propPolicyId || viewModel.data.propPolicyId === -1 ) {
        viewModel.dispatch( { path: 'data.propPolicyId', value: registerPropPolicy( viewModel, initialRowVM.type ) } );
    }

    // Scroll to new row
    let scrollEventData = {
        gridId: viewModel.data.providerName,
        rowUids: [ initialRowVM.uid ]
    };

    eventBus.publish( 'plTable.scrollToRow', scrollEventData );
};

/**
 * Processes the initial row data event and prepares the dummy row to be added to the grid
 *
 * @param {Object} eventData holding tableRowData as returned by the server
 * @param {Object} viewModel the view model
 */
export const processInitialRowDataEvent = function( eventData, viewModel ) {
    const { tableRowData } = eventData;
    const propData = exports.getPropertyData( viewModel );
    // process the event only if this instance is meant to
    if( tableRowData && propData.id === appCtxService.getCtx( 'ActiveTablePropertyId' ) ) {
        let viewModelCollection = viewModel.dataProviders[ viewModel.data.providerName ].viewModelCollection;
        let loadedVMObjs = viewModelCollection.getLoadedViewModelObjects();
        let totalFound = loadedVMObjs && loadedVMObjs.length ? loadedVMObjs.length : 0;
        let initialRowType = tableRowData[ 0 ].tableRowTypeName;
        let initialTableRowData = tableRowData[ 0 ].tableRowData;

        let setPropValueUpdated = tableRowData[ 0 ].setPropValueUpdated;

        if( !viewModel.data._persistentVMOs ) {
            viewModel.data._persistentVMOs = loadedVMObjs;
        }

        let existingAdditionalProps = appCtxService.getCtx( 'InitialSaveDataAdditionalProps' );
        existingAdditionalProps = existingAdditionalProps ? existingAdditionalProps : {};
        let additionalProps = existingAdditionalProps[ propData.propertyName ];
        additionalProps = additionalProps ? additionalProps : {};
        additionalProps.newRowTypeName = initialRowType;
        existingAdditionalProps[ propData.propertyName ] = additionalProps;
        appCtxService.updateCtx( 'InitialSaveDataAdditionalProps', existingAdditionalProps );

        let initialVMOs = [ ...loadedVMObjs ];

        // Creating a dummy model object for table row
        let dummyUid = cdm.NULL_UID + viewModel.data.providerName + '_' + totalFound;
        let modelObject = {};
        modelObject.uid = cdm.NULL_UID;
        modelObject.alternateID = dummyUid;

        modelObject.type = initialRowType;

        modelObject.props = {};
        let modelType = cmm.getType( initialRowType );
        if( !modelType ) {
            let missingTypes = [];
            missingTypes.push( initialRowType );
            // need to load from server
            soaSvc.ensureModelTypesLoaded( missingTypes ).then(
                function() {
                    modelType = cmm.getType( initialRowType );
                    exports.updateGridWithInitialRow( viewModel, initialTableRowData, initialVMOs,
                        modelType, modelObject, dummyUid, setPropValueUpdated );
                } );
        } else {
            exports.updateGridWithInitialRow( viewModel, initialTableRowData, initialVMOs, modelType,
                modelObject, dummyUid, setPropValueUpdated );
        }
    }
};

/**
 * Processes remove row data event and updates non-deleted grid rows with context object and
 * property to enable successful deletion of selected grid rows(s)
 *
 * @param {Object} eventData holding selected objects that need to be deleted
 * @param {Object} viewModel - the view model
 */
export const processRemoveRowDataEvent = function( eventData, viewModel ) {
    const propData = exports.getPropertyData( viewModel );
    // process the event only if this instance is meant to
    if( propData.id === appCtxService.getCtx( 'ActiveTablePropertyId' ) ) {
        propData.removeCommandEnabled = false;

        // Remove and Duplicate command should be in sync. when we remove a row, we should also disable duplicate command for that row.
        // Duplicate command is controlled with tablePropertyEditData, so we need to unregister it.
        appCtxService.unRegisterCtx( 'tablePropertyEditData' );

        const dataProvider = viewModel.dataProviders[ viewModel.data.providerName ];

        let uidsToDelete = [];
        if( eventData && eventData.selectionData && eventData.selectionData[ viewModel.data.providerName ] ) {
            _.forEach( eventData.selectionData[ viewModel.data.providerName ].selectedObjects, function( data ) {
                uidsToDelete.push( data.uid );
            } );
        }

        let viewModelCollection = dataProvider.viewModelCollection;
        let loadedVMObjs = viewModelCollection.getLoadedViewModelObjects();

        // Do not include dummy vmo information in the objectsToBeRestored.
        // This objectsToBeRestored will be used for cancel edit operation.
        if( !viewModel.data.objectsToBeRestored || viewModel.data.objectsToBeRestored.length === 0 ) {
            let objectsToBeRestored = [];
            _.forEach( loadedVMObjs, function( loadedVmo ) {
                if( !loadedVmo.uid.includes( cdm.NULL_UID )  ) {
                    objectsToBeRestored.push( loadedVmo );
                }
            } );
            viewModel.data.objectsToBeRestored = objectsToBeRestored;
        }

        let loadedVMOsToBeKept = {
            viewModelObjects: []
        };
        _.forEach( loadedVMObjs, function( loadedVmo ) {
            if( !_.includes( uidsToDelete, loadedVmo.uid ) ) {
                loadedVMOsToBeKept.viewModelObjects.push( loadedVmo );
            }
        } );

        viewModel.data._removedVMOUids = _.union( viewModel.data._removedVMOUids, uidsToDelete );
        dataProvider.update( loadedVMOsToBeKept.viewModelObjects, loadedVMOsToBeKept.viewModelObjects.length );

        viewModel.data._syncFromCdm = true;
        viewModel.dispatch( { path: 'data', value: { ...viewModel.data } } );
    }
};

export const updateVMOContext = function( eventData ) {
    appCtxService.registerCtx( 'tablePropertyEditData', { vmo: eventData.vmo, gridId: eventData.gridId } );
    appCtxService.registerCtx( 'ActiveTablePropertyId', eventData.gridId );
};

/**
 * Removes the application Context for tablePropertyEdit
 * @param {Object} eventData -
 */
export const removeVMOContext = function( eventData ) {
    if( eventData.state !== 'starting' ) {
        appCtxService.unRegisterCtx( 'tablePropertyEditData' );
    }
};

/**
 * Processes the editHandlerStateChange event
 * When the state is cancelling Load the original view model objects
 * back into the table thereby discarding any vmo's added via
 * getInitialTableRowData call. If canceling or saving remove the
 * context vmo object added from editing
 *
 * @param {Object} eventData - the event data
 * @param {Object} viewModel - the view model
 */
export const processCancelEditsEvent = function( eventData, viewModel ) {
    if( eventData ) {
        if( eventData.state === 'canceling' && viewModel.data.objectsToBeRestored && viewModel.data.objectsToBeRestored.length > 0 ) {
            viewModel.data._persistentVMOs = viewModel.data.objectsToBeRestored;
        }
        const propData = exports.getPropertyData( viewModel );
        let dataProvider = viewModel.dataProviders[ viewModel.data.providerName ];
        if( eventData.state === 'canceling' ) {
            var activeEditHandler = editHandlerService.getActiveEditHandler();
            if( activeEditHandler && viewModel.data.preSaveActionID ) {
                activeEditHandler.unregisterPreSaveAction( viewModel.data.preSaveActionID );
                delete viewModel.data.preSaveActionID;
            }

            if( viewModel.data._persistentVMOs ) {
                let updatedVMOs = {
                    viewModelObjects: []
                };

                let persistentVmoUids = [];
                _.forEach( viewModel.data._persistentVMOs, function( persistentVmo ) {
                    persistentVmoUids.push( persistentVmo.uid );
                } );

                // The below condition says there are few rows deleted. We need to restore them to original position after cancel edit.
                if( viewModel.data.objectsToBeRestored && viewModel.data.objectsToBeRestored.length > 0 ) {
                    _.forEach( viewModel.data.objectsToBeRestored, function( loadedVmo ) {
                        updatedVMOs.viewModelObjects.push( loadedVmo );
                    } );
                } else {
                    let viewModelCollection = dataProvider.viewModelCollection;
                    let loadedVMObjs = viewModelCollection.getLoadedViewModelObjects();
                    _.forEach( loadedVMObjs, function( loadedVmo ) {
                        if( _.includes( persistentVmoUids, loadedVmo.uid ) ) {
                            updatedVMOs.viewModelObjects.push( loadedVmo );
                        }
                    } );
                }

                dataProvider.update( updatedVMOs.viewModelObjects, updatedVMOs.viewModelObjects.length );
                delete viewModel.data._persistentVMOs;
                delete viewModel.data.objectsToBeRestored;
            }
        } else if( eventData.state === 'partialSave' ) {
            let vmCollection = dataProvider.viewModelCollection;
            let loadedVMOs = vmCollection.getLoadedViewModelObjects();
            for( let i = 0; i < loadedVMOs.length; i++ ) {
                let vmo = loadedVMOs[ i ];

                // Set all vmos to have owning object and tablePropertyName to save properly
                if( !vmo.props.owningObject ) {
                    exports.addContextObjectAndProperty( propData, vmo, 'edit' );
                }
                // preserve the previous display value as setting editable states corrupts it.
                let prevDisplayValues = {};
                _.forEach( vmo.props, function( prop ) {
                    prevDisplayValues[ prop.propertyName ] = prop.prevDisplayValues;
                    if( prop.newValue || prop.newDisplayValues ) {
                        prop.valueUpdated = true;
                    }
                } );
                // put all vmos back into edit
                viewModelObjectService.setEditableStates( vmo, true, true, true );
                // set the previous display values back to the vmo.
                _.forEach( vmo.props, function( prop ) {
                    prop.prevDisplayValues = prevDisplayValues[ prop.propertyName ];
                } );
            }
        }
    }

    delete viewModel.data._removedVMOUids;
    // Remove Edit VMO context if necessary
    exports.removeVMOContext( eventData );
    viewModel.dispatch( { path: 'data', value: { ...viewModel.data } } );
};

/**
 * Registers the property policy based on new row type and data provider columns.
 * @param {Viewmodel} viewModel - the view model
 * @param {string} rowTypeName - the row type name
 * @returns {int} - The policy id or -1 if no policy was registered.
 */
const registerPropPolicy = function( viewModel, rowTypeName ) {
    const { dataProviders, data } = viewModel;
    if( !dataProviders || !data ) {
        return -1;
    }
    let dataProvider = dataProviders[ data.providerName ];
    if( dataProvider ) {
        const policy = {
            types: []
        };
        const columns = dataProvider.cols;

        const policyType = {
            name: rowTypeName,
            properties: [],
            modifiers: [
                {
                    name: 'includeIsModifiable',
                    Value: 'true'
                }
            ]
        };
        for( let col of columns ) {
            policyType.properties.push( {
                name: col.name
            } );
        }
        policy.types.push( policyType );
        return propertyPolicySvc.register( policy );
    }
    return -1;
};

const preSaveAction = function( viewModel ) {
    // Add dummy rows for deletion. Function checks if it is necessary or not.
    exports.addDummyRows( viewModel );
};

export const initSubscriptions = function( viewModel, selectionData ) {
    let subDefs = viewModel.data.subDefs || [];
    const propType = exports.getPropertyType( viewModel );
    subDefs.push( eventBus.subscribe( `${viewModel.data.providerName}.selectionChangeEvent`, function( eventData ) {
        exports.processGridSelectionEvent( eventData, viewModel );
    } ) );
    subDefs.push( eventBus.subscribe( 'cdm.created', function( eventData ) {
        // When we create a brand new row, click on a cell to add some property value, that row is selected.
        // For this new row case, the selection should be cleared after create row operation is completed.
        if( selectionData && selectionData.getValue() && selectionData.getValue().selected && selectionData.getValue().selected.length === 1 ) {
            let selectedObjects = selectionData.getValue().selected;
            // A uid will have cdm.NULL_UID for the brand new row that is yet to be created.
            if( selectedObjects && selectedObjects[ 0 ].uid.includes( cdm.NULL_UID ) ) {
                selectionData.update( { selected: [] } );
            }
        }
        exports.processCdmCreatedEvent( eventData, viewModel );
    } ) );
    subDefs.push( eventBus.subscribe( `${propType}RowData.remove`, function( eventData ) {
        exports.processRemoveRowDataEvent( eventData, viewModel );
    } ) );
    subDefs.push( eventBus.subscribe( `${propType}InitialRowData.createSuccessful`, function( eventData ) {
        exports.processInitialRowDataEvent( eventData, viewModel );
    } ) );
    subDefs.push( eventBus.subscribe( 'editHandlerStateChange', function( eventData ) {
        const { dataProviders } = viewModel;
        let dataProvider = null;
        dataProvider = dataProviders[ viewModel.data.providerName ];
        let eventContext = eventData.dataSource && ( eventData.dataSource.context || eventData.dataSource.editContext );

        if( eventContext !== dataProvider?.editContext ) {
            return;
        }

        exports.processCancelEditsEvent( eventData, viewModel );

        if( eventData.state === 'starting' ) {
            const activeEditHandler = editHandlerService.getActiveEditHandler();
            if( activeEditHandler ) {
                const preSaveActionFunc = function() {
                    preSaveAction( viewModel );
                };
                viewModel.data.preSaveActionID = activeEditHandler.registerPreSaveAction( preSaveActionFunc );
            }

            // set tablePropertyEditData
            if( dataProvider ) {
                const selectedObjects = dataProvider.getSelectedObjects();
                if( selectedObjects && selectedObjects.length > 0 ) {
                    const lastSelectedObject = selectedObjects[ selectedObjects.length - 1 ];
                    appCtxService.registerCtx( 'tablePropertyEditData', { vmo: lastSelectedObject, gridId: viewModel.data.providerName } );
                }
            }
        } else if( eventData.state === 'saved' ) {
            // clear presave action
            const activeEditHandler = editHandlerService.getActiveEditHandler();
            if( activeEditHandler && viewModel.data.preSaveActionID ) {
                activeEditHandler.unregisterPreSaveAction( viewModel.data.preSaveActionID );
                delete viewModel.data.preSaveActionID;
            }
            // clear things that no longer matter now that we saved
            delete viewModel.data.objectsToBeRestored;
            delete viewModel.data._removedVMOUids;
            delete viewModel.data._persistentVMOs;
            viewModel.dispatch( { path: 'data', value: { ...viewModel.data } } );
        }
    } ) );
    subDefs.push( eventBus.subscribe( `${viewModel.data.providerName}.cellStartEdit`, function( eventData ) {
        exports.updateVMOContext( eventData );
    } ) );
    viewModel.data.subDefs = subDefs;
};

export const setTablePropertyInitialRowDataInput = function( viewModel ) {
    const propertyData = exports.getPropertyData( viewModel );
    const owningObjectUid = propertyData.parentUid;
    const tablePropertyName = propertyData.propertyName;
    appCtxService.registerCtx( 'TablePropertyInitialRowDataInput', {
        owningObject: {
            uid: owningObjectUid
        },
        tablePropertyName: tablePropertyName
    } );
};

export const preProcessAction = function( viewModel ) {
    const propData = exports.getPropertyData( viewModel );
    const propType = exports.getPropertyType( viewModel );

    if( propType === 'TableProperty' ) {
        exports.setTablePropertyInitialRowDataInput( viewModel );
    }

    appCtxService.registerCtx( 'ActiveTablePropertyId', propData.id );
};

/**
 * Initializes what is needed for name value or table property tables after property data is set
 *
 * @param {Object} viewModel the view model
 * @param {Object} selectionData selection data
 * @param {Function} specificContextInit Context initialization function specific for table prop or name value
 */
// only nameValue pair code sends specificContextInit but not table properties code.
export const init = function( viewModel, selectionData, specificContextInit ) {
    // Set provider name
    viewModel.data.providerName = `${viewModel.data._propertyData.id}_Provider`;
    exports.initContext( viewModel, specificContextInit );
    exports.initSubscriptions( viewModel, selectionData );
};

/**
 * Adds Dummy rows when we delete rows for save SOA.
 *
 * @param {Object} viewModel the view model
 */
export const addDummyRows = function( viewModel ) {
    const removedVmoUids = viewModel.data?._removedVMOUids;

    if( !removedVmoUids || removedVmoUids.length === 0 ) {
        return;
    }

    const dataProvider = viewModel.dataProviders[ viewModel.data.providerName ];
    const propData = exports.getPropertyData( viewModel );

    const viewModelCollection = dataProvider.viewModelCollection;
    if( viewModelCollection ) {
        let loadedVMObjs = viewModelCollection.getLoadedViewModelObjects();
        const newCollection = {
            viewModelObjects: loadedVMObjs
        };
        for( let i = 0; i < removedVmoUids.length; i++ ) {
            const originalVmo = viewModel.data.objectsToBeRestored?.find( ( item )=>item.uid === removedVmoUids[i] );
            const dummyModelObj = {
                props: {},
                uid: removedVmoUids[i],
                alternateID: removedVmoUids[i] + viewModel.data.providerName,
                modelType: originalVmo?.modelType,
                type: originalVmo?.type
            };
            const dummyVmo = viewModelObjectService.constructViewModelObject( dummyModelObj );
            exports.addContextObjectAndProperty( propData, dummyVmo, 'remove' );

            newCollection.viewModelObjects.push( dummyVmo );
        }

        dataProvider.update( newCollection.viewModelObjects, newCollection.viewModelObjects.length );
    }
};

/**
 * Get sortCriteria information from the server.
 *
 * @param {Object} TablePropOrNameValueData TableProperty Or NameValueProperty Data
 * @param {Object} sortCriteria sort criteria
 */
export const getSortCriteriaForTablePropOrNameValue = function( TablePropOrNameValueData, sortCriteria ) {
    if( TablePropOrNameValueData && TablePropOrNameValueData.sortBy ) {
        sortCriteria.fieldName = TablePropOrNameValueData.sortBy;
        let sortDirection = TablePropOrNameValueData.sortDirection;
        switch ( sortDirection ) {
            case 'descending':
                sortDirection = 'DESC';
                break;
            case 'ascending':
            default:
                sortDirection = 'ASC';
        }
        sortCriteria.sortDirection = sortDirection;
    }
};

export const cleanup = function( viewModel, dpRef ) {
    var activeEditHandler = editHandlerService.getActiveEditHandler();
    if( activeEditHandler && viewModel.data.preSaveActionID ) {
        activeEditHandler.unregisterPreSaveAction( viewModel.data.preSaveActionID );
        delete viewModel.data.preSaveActionID;
    }
    delete viewModel.data._persistentVMOs;
    delete viewModel.data._removedVMOUids;
    delete viewModel.data.objectsToBeRestored;
    const propData = exports.getPropertyData( viewModel ) || {};
    const propType = exports.getPropertyType( viewModel ) || '';

    appCtxService.unRegisterCtx( 'ActiveTablePropertyId' );
    appCtxService.unRegisterCtx( 'TablePropertyInitialRowDataInput' );
    appCtxService.unRegisterCtx( propData.initialRowDataInput );
    appCtxService.unRegisterCtx( 'tablePropertyEditData' );
    appCtxService.unRegisterCtx( `${propType}Selection` );

    if( propType === 'NameValue' ) {
        appCtxService.unRegisterCtx( 'InitialLovDataAdditionalProps' );
    }
    _.forEach( viewModel.data.subDefs, function( sub ) {
        eventBus.unsubscribe( sub );
    } );

    const dpName = viewModel.data.providerName;
    const dp = viewModel.dataProviders[ dpName ];
    if( dp && dpRef.current && dpRef.current.dataProviders.includes( dp.viewModelCollection.getLoadedViewModelObjects ) ) {
        let index = dpRef.current.dataProviders.indexOf( dp.viewModelCollection.getLoadedViewModelObjects );
        if( index > -1 ) {
            dpRef.current.dataProviders.splice( dp.viewModelCollection.getLoadedViewModelObjects, 1 );
        }
    }

    // cleanup property policy
    if( viewModel.data.propPolicyId && viewModel.data.propPolicyId !== -1 ) {
        propertyPolicySvc.unregister( viewModel.data.propPolicyId );
    }
};

exports = {
    createDynamicTablePropertyViewModel,
    getPropertyData,
    setPropertyData,
    getPropertyType,
    processInitialDataProvider,
    initContext,
    processGridSelectionEvent,
    updateGridWithInitialRow,
    processInitialRowDataEvent,
    processRemoveRowDataEvent,
    updateVMOContext,
    removeVMOContext,
    processCancelEditsEvent,
    initSubscriptions,
    processCdmCreatedEvent,
    addProperty,
    addContextObjectAndProperty,
    updateVmoData,
    setTablePropertyInitialRowDataInput,
    preProcessAction,
    init,
    addDummyRows,
    getSortCriteriaForTablePropOrNameValue,
    cleanup
};

export default exports;
