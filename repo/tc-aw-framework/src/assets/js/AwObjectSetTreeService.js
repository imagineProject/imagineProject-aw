// Copyright (c) 2024 Siemens

import AwSplmTable from 'viewmodel/AwSplmTableViewModel';
import _ from 'lodash';
import awTableTreeSvc from 'js/splmTablePublishedTreeService';
import awIconService from 'js/awIconService';
import AwPromiseService from 'js/awPromiseService';
import soaSvc from 'soa/kernel/soaService';
import { getAdaptedObjectsSync } from 'js/adapterService';
import appCtxService from 'js/appCtxService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import notySvc from 'js/NotyModule';
import cdm from 'soa/kernel/clientDataModel';
import xrtUtilities from 'js/xrtUtilities';
import columnArrangeService from 'js/columnArrangeService';
import treeTableDataService from 'js/treeTableDataService';
import tcViewModelObjectService from 'js/tcViewModelObjectService';
import tcDataManagementService from 'js/tcDataManagementService';

export const awObjectSetTreeRenderFunction = ( { viewModel, showCheckBox, fields, selectionData, selectionModel } ) => {
    return <AwSplmTable {...viewModel.grids.AwObjectSetTree} useTree={true} reusable='true' showCheckBox={showCheckBox} selectionData={selectionData} selectionModel={selectionModel}
        tableContext={{ columnsData: fields.columnsData }} showContextMenu={true}></AwSplmTable>;
};

export const initializeObjectSetTreeData = async( treeLoadInput, firstPageUids, objectSetInfo, firstPageResultsInVM,
    objectSetUri, columns, initialOperationType, updatedOperationType, columnFilters, xrtContext, objectSetData,
    vmo, sortCriteria, startIndex, colsToInflate, reload, objectSetState, totalFound, parentUid, showRelations, showRootNode ) => {
    if ( !treeLoadInput ) {
        return AwPromiseService.instance.resolve();
    }
    let firstPageObjs = [];
    let treeLoadResult = {};
    let rootPathNodes = [];
    let treeLoadOutput = {};

    let response = {};

    if ( showRelations === 'allLevels' ) {
        response = await getDataFromPerformSearchViewModel( initialOperationType, columnFilters, xrtContext,
            objectSetData, objectSetUri, sortCriteria, startIndex, colsToInflate, objectSetState, getAdaptedObjectsSync( [ cdm.getObject( parentUid ) ] ) );
        response.firstPageObjs = response.searchResults;
    } else {
        response = await xrtUtilities.loadObjectSetData( firstPageUids, objectSetInfo, firstPageResultsInVM,
            objectSetUri, columns, initialOperationType, updatedOperationType, columnFilters, xrtContext, objectSetData,
            vmo, sortCriteria, startIndex, colsToInflate, reload, objectSetState, totalFound, parentUid );
    }

    if ( response && response.firstPageObjs ) {
        firstPageObjs = [ ...response.firstPageObjs ];
    } else if ( firstPageUids && firstPageUids.length > 0 && objectSetInfo && objectSetInfo.firstPage ) {
        _.forEach( firstPageUids, function( uid ) {
            if ( uid ) {
                let objects = objectSetInfo.firstPage.filter( obj => obj.uid === uid );
                for ( const obj of objects ) {
                    if ( obj ) {
                        firstPageObjs.push( obj );
                    }
                }
            }
        } );
    }
    let nextLevelNdx = 0;
    if( showRootNode ) {
        let adaptedVmo = cdm.getObject( parentUid );
        const vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( adaptedVmo );
        let currNode = createVMNodeUsingObjectInfo( vmo, 0, nextLevelNdx );
        currNode.alternateID = getUniqueIdForEachNode( currNode );
        currNode.isExpanded = firstPageObjs.length !== 0;
        rootPathNodes.push( currNode );
        nextLevelNdx++;
    }
    if ( firstPageObjs && firstPageObjs.length > 0 ) {
        _.forEach( firstPageObjs, function( viewModelObject, index ) {
            let currNode = createVMNodeUsingObjectInfo( viewModelObject, index, nextLevelNdx );
            currNode.alternateID = getUniqueIdForEachNode( currNode );
            rootPathNodes.push( currNode );
        } );
        if( rootPathNodes.length && response.cursor ) {
            rootPathNodes[rootPathNodes.length - 1].incompleteTail = !response.cursor.endReached;
        }
        nextLevelNdx++;
    }
    if ( rootPathNodes.length > 0 ) {
        treeLoadOutput.rootPathNodes = rootPathNodes;
        treeLoadOutput.newTopNode = _.first( treeLoadOutput.rootPathNodes );
    }
    if( !response.cursor ) {
        response.cursor = {
            startIndex: 0,
            startReached: true,
            endIndex: response.totalFound - 1,
            endReached: rootPathNodes?.length === response.totalFound
        };
    }
    treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, rootPathNodes, true, true,
        response.cursor?.endReached, null );
    treeLoadResult.parentNode.cursorObject = response.cursor;
    return {
        treeLoadResult: treeLoadResult,
        totalFound: response.totalFound,
        columnConfig: response.columnConfig
    };
};

export const createVMNodeUsingObjectInfo = function( obj, childNdx, levelNdx ) {
    let displayName;
    let objUid = obj.uid;
    let objType = obj.type;
    if ( obj.props ) {
        if ( obj.props.object_string ) {
            displayName = obj.props.object_string.uiValues[0];
        }
    }
    let iconURL = awIconService.getTypeIconFileUrl( obj );
    let vmNode = awTableTreeSvc.createViewModelTreeNode( objUid, objType, displayName, levelNdx, childNdx, iconURL );
    vmNode.isLeaf = false;
    vmNode.indicators =  obj.indicators ? obj.indicators : undefined;
    vmNode.modelType = obj.modelType ? obj.modelType : undefined;
    vmNode.thumbnailURL = awIconService.getThumbnailFileUrl( obj );
    vmNode.hasThumbnail =  Boolean( vmNode.thumbnailURL );
    vmNode.props = { ...obj.props };
    vmNode.uid = obj.uid;
    return vmNode;
};

export const loadObjectSetDataForTree = function( treeLoadInput, firstPageUids, objectSetInfo, objectsetUri, initialOperationType, updatedOperationType, columnFilters,
    xrtContext, objectSetData, sortCriteriaIn, startIndex, colsToInflate, objectSetState, dataProvider, parentUid, showRelations ) {
    if ( !treeLoadInput ) {
        return AwPromiseService.instance.resolve();
    }

    const parentNode = treeLoadInput.parentNode;
    let nodeToExpand = parentNode.uid;

    if ( nodeToExpand === 'top' ) {
        nodeToExpand = parentUid;
    }

    let treeLoadOutput = {};
    let vmObjects = [];

    if ( !vmObjects || vmObjects.length === 0 ) {
        const attachedObj = cdm.getObject( nodeToExpand );
        const vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( attachedObj );
        vmObjects.push( vmo );
    }
    let operationType = updatedOperationType ? updatedOperationType : initialOperationType;
    let providerName = !showRelations && parentNode.levelNdx === -1 ? 'Awp0ObjectSetRowProvider' : 'Awp0GetChildrenProvider';
    return getDataFromPerformSearchViewModel( operationType, columnFilters, xrtContext,
        objectSetData, objectsetUri, sortCriteriaIn, startIndex, colsToInflate, objectSetState, vmObjects, dataProvider, providerName ).then( function( response ) {
        let treeLoadResult = {};
        let vmNodes = [];
        let nextLevelNdx = parentNode.levelNdx + 1;
        if ( response && response.searchResults && response.searchResults.length > 0 ) {
            _.forEach( response.searchResults, function( viewModelObject, index ) {
                let currNode = createVMNodeUsingObjectInfo( viewModelObject, index, nextLevelNdx );
                currNode.alternateID = getUniqueIdForEachNode( currNode, parentNode );
                vmNodes.push( currNode );
            } );
            nextLevelNdx++;
        }
        if ( vmNodes.length > 0 ) {
            treeLoadOutput.vmNodes = vmNodes;
            treeLoadOutput.newTopNode = _.first( treeLoadOutput.vmNodes );
        } else {
            treeLoadInput.parentNode.isLeaf = true;
        }
        treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, vmNodes, true, true,
            response.cursor.endReached, null );
        return {
            treeLoadResult: treeLoadResult,
            totalFound: vmNodes.length
        };
    } );
};

export let getDataFromPerformSearchViewModel = function( operationType, columnFilters, xrtContext,
    objectSetData, objectsetUri, sortCriteriaIn, startIndex, colsToInflate, objectSetState, vmObjects, dataProvider, providerName ) {
    if ( !vmObjects || vmObjects.length === 0 ) {
        return AwPromiseService.instance.resolve();
    }

    let sortCriteria = sortCriteriaIn;
    if ( !sortCriteria ) {
        sortCriteria = [ {} ];
        if ( objectSetData.sortBy ) {
            sortCriteria[0].fieldName = objectSetData.sortBy;
            let sortDirection = objectSetData.sortDirection;
            switch ( sortDirection ) {
                case 'descending':
                    sortDirection = 'DESC';
                    break;
                case 'ascending':
                default:
                    sortDirection = 'ASC';
            }
            sortCriteria[0].sortDirection = sortDirection;
        }
    }

    let adaptedVmo = {};
    let adaptedObjArr = getAdaptedObjectsSync( vmObjects );
    if ( adaptedObjArr && adaptedObjArr.length > 0 ) {
        adaptedVmo = adaptedObjArr[0];
    }

    let excludePropertyNames = '';
    if( appCtxService.ctx?.preferences?.AWC_Relations_to_exclude_tree_display && appCtxService.ctx.preferences.AWC_Relations_to_exclude_tree_display.length > 0 ) {
        excludePropertyNames = appCtxService.ctx.preferences.AWC_Relations_to_exclude_tree_display.toString();
    }

    return tcDataManagementService.basePerformSearchViewModel( {
        columnConfigInput: {
            clientName: 'AWClient',
            clientScopeURI: objectsetUri,
            operationType: operationType
        },
        searchInput: {
            columnFilters: columnFilters,
            maxToLoad: 50,
            maxToReturn: 50,
            providerName: providerName ? providerName : 'Awp0GetChildrenProvider',
            searchCriteria: {
                'ActiveWorkspace:Location': appCtxService.getCtx( 'locationContext.ActiveWorkspace:Location' ),
                'ActiveWorkspace:SubLocation': appCtxService.getCtx( 'locationContext.ActiveWorkspace:SubLocation' ),
                'ActiveWorkspace:xrtContext': xrtUtilities.getActiveWorkspaceXrtContext( xrtContext ),
                isRedLineMode: appCtxService.getCtx( 'isRedLineMode' ),
                objectSet: objectSetData.source,
                parentUid: adaptedVmo.uid,
                showConfiguredRev: objectSetData.showConfiguredRev,
                excludedPropertyNames: excludePropertyNames
            },
            searchSortCriteria: sortCriteria,
            startIndex: startIndex,
            attributesToInflate: colsToInflate
        },
        inflateProperties: true
    } ).then( function( response ) {
        if ( response.ServiceData && response.ServiceData.partialErrors &&
            response.ServiceData.partialErrors.length > 0 ) {
            notySvc.showError( response.ServiceData.partialErrors[0].errorValues[0].message );
        }
        if ( response.searchResultsJSON ) {
            response.searchResults = JSON.parse( response.searchResultsJSON );
        }
        if ( response.totalLoaded && objectSetState && objectSetState.getValue ) {
            let newObjectSetState = { ...objectSetState.getValue() };
            let totalVMObjectsLoaded = dataProvider?.viewModelCollection?.totalFound ? dataProvider.viewModelCollection.totalFound + response.totalLoaded : response.totalLoaded;
            if ( totalVMObjectsLoaded !== objectSetState.totalLoaded ) {
                newObjectSetState.totalLoaded = totalVMObjectsLoaded;
                objectSetState.update( newObjectSetState );
            }
        }
        response.searchResults = response.searchResults &&
            response.searchResults.objects ? response.searchResults.objects.map( function( vmo ) {
                return viewModelObjectSvc.createViewModelObject( vmo.uid, 'EDIT', null, vmo );
            } ) : [];
        return response;
    } );
};

export let getAttributesToInflate = function( columnConfig, newColumns ) {
    let attributesToInflate = [];
    let inputColumns = columnConfig && columnConfig.columns && columnConfig.columns.length ? columnConfig.columns : newColumns;
    if ( inputColumns ) {
        _.forEach( inputColumns, function( uwColumnInfo ) {
            if ( ( uwColumnInfo.field || uwColumnInfo.propertyName ) && uwColumnInfo.hiddenFlag !== true ) {
                attributesToInflate.push( uwColumnInfo.field || uwColumnInfo.propertyName );
            }
        } );
    }
    return attributesToInflate;
};

export const loadColumns = function( serverColumnConfig, props ) {
    let columnConfig = {
        columns: []
    };
    let columnInfos = [];
    let columns = serverColumnConfig?.columns && serverColumnConfig?.columns.length > 0 ? serverColumnConfig.columns : props.columns;
    if ( props && columns ) {
        columns.forEach( ( column, index ) => {
            let treeColumn = { ...column };
            treeColumn.isTreeNavigation = index === 0;
            columnInfos.push( treeColumn );
        } );
        columnConfig = {
            columnConfigId: serverColumnConfig?.columnConfigId || props.objectSetUri,
            columns: columnInfos,
            operationType: serverColumnConfig?.operationType || props.operationType
        };
    }
    return {
        columnInfos: columnInfos,
        columnConfig: columnConfig,
        objectSetUri: props.objectSetUri
    };
};

export const arrangeObjectSetColumns = ( eventData, viewModel, props ) => {
    if ( eventData.objectSetUri === props.objectSetUri || eventData.columnConfigId === viewModel?.dataProviders?.AwObjectSetTreeProvider?.columnConfig?.columnConfigId ) {
        eventData.props = props;
        columnArrangeService.arrangeColumns( viewModel, eventData );
    }
};

export const handleCdmEventForTree = ( dataProvider, eventData, objectSetSource, vmo, isRefreshAllObjectSets, data ) => {
    let relatedModified = false;
    if ( vmo && eventData.relatedModified ) {
        let loadedVMObjects = [ vmo, ...dataProvider.viewModelCollection?.loadedVMObjects || [] ];
        for ( const modified of eventData.relatedModified ) {
            for ( const loadedVmo of loadedVMObjects ) {
                if ( modified.alternateID === loadedVmo.alternateID && xrtUtilities.checkIfObjectModified( objectSetSource, loadedVmo, eventData, isRefreshAllObjectSets ) ) {
                    relatedModified = true;
                    if ( !loadedVmo.isExpanded ) {
                        let gridId = Object.keys( data.grids )[0];
                        awTableTreeSvc.saveRowExpanded( data, gridId, modified );
                    }
                    updateSelectionAfterCdmEvent( dataProvider, eventData );
                    break;
                }
            }
        }
    }
    if ( relatedModified ) {
        dataProvider.resetDataProvider();
    }
};

const updateSelectionAfterCdmEvent = function( dataProvider, eventData ) {
    if ( !_.isEmpty( eventData.childObjects ) && eventData.childObjects.length > 0 ) {
        const selectedData = dataProvider?.selectionModel?.selectionData?.selected;
        if( selectedData && selectedData.length > 0 ) {
            let childObjUids = [];
            _.forEach( eventData.childObjects, function( childObj ) {
                childObjUids.push( childObj.uid );
            } );
            _.forEach( selectedData, function( selectedObj ) {
                    var targetObj = _.get( selectedObj, 'props.awp0Target' );
                    if( targetObj && childObjUids.includes( targetObj.dbValue ) ) {
                        dataProvider.selectionModel.removeFromSelection( selectedObj );
                    }
            } );
        }
    }
};


const getUniqueIdForEachNode = function( vmNode, parentNode ) {
    if ( parentNode ) {
        return parentNode.alternateID ? vmNode.uid + ',' + parentNode.alternateID : vmNode.uid + ',' + parentNode.uid;
    }
    return vmNode.uid;
};
export const updateTotalFoundOnObjectSetState = function( objectSetState, totalFound, dataFetchedForUid ) {
    if( objectSetState && totalFound > -1 ) {
        let newObjectSetState = { ...objectSetState.getValue() };
        newObjectSetState.totalFound = totalFound;
        newObjectSetState.dataFetchedForUid = dataFetchedForUid;
        objectSetState.update( newObjectSetState );
    }
};

export let updateObjectSetTreeTableColumns = function( data, dataProvider ) {
    let output = {};
    if( dataProvider && data.newColumnConfig ) {
        var propColumns = data.newColumnConfig.columns;
        updateColumnPropsAndNodeIconURLs( propColumns, dataProvider.getViewModelCollection().getLoadedViewModelObjects() );
        data.newColumnConfig.columns = propColumns;
        dataProvider.columnConfig = data.newColumnConfig;
    }
    output.newColumnConfig = data.newColumnConfig;
    output.columnConfig = dataProvider.columnConfig;
    return output;
};

/**
 * Function to update tree table columns props and icon urls
 * @param {Object} propColumns Contains prop columns
 * @param {Object} childNodes Contains tree nodes
 */
function updateColumnPropsAndNodeIconURLs( propColumns, childNodes ) {
    _.forEach( propColumns, function( col ) {
        if( !col.typeName && col.associatedTypeName ) {
            col.typeName = col.associatedTypeName;
        }
    } );
    propColumns[ 0 ].enableColumnMoving = false;
    let _firstColumnPropertyName = propColumns[ 0 ].propertyName;

    _.forEach( childNodes, function( childNode ) {
        childNode.iconURL = awIconService.getTypeIconFileUrl( childNode );
        treeTableDataService.updateVMODisplayName( childNode, _firstColumnPropertyName );
    } );
}

export let getTableViewModelProperties = function( vmNodes, context ) {
    let objectUids = [];
    let clientScope = context.clientScopeURI ? context.clientScopeURI : '';
    let clientName = context.clientName ? context.clientName : '';
    let typesForArrange = context.typesForArrange ? context.typesForArrange : [];
    let columnsToExclude = context.columnsToExclude ? context.columnsToExclude : [];
    let operationType = context.operationType ? context.operationType : 'Union';

    let addedColumnNames = [];
    if( context && context.addedColumnNames && context.addedColumnNames.length > 0 ) {
        addedColumnNames = context.addedColumnNames;
    }
    let adaptedObjArr = getAdaptedObjectsSync( vmNodes );
    if ( adaptedObjArr && adaptedObjArr.length > 0 ) {
        _.forEach( adaptedObjArr, function( adaptedObj ) {
            objectUids.push( adaptedObj.uid );
        } );
    }
    let input = {
        input: {
            objectUids: objectUids,
            columnConfigInput: {
                clientName: clientName,
                hostingClientName: '',
                clientScopeURI: clientScope,
                operationType: operationType,
                columnsToExclude: columnsToExclude
            },
            requestPreference: {
                typesToInclude: typesForArrange,
                columnsToInflate: addedColumnNames
            }
        }
    };
    if( objectUids.length > 0 ) {
        return tcDataManagementService.baseGetTableViewModelProperties( input ).then( function( response ) {
            updateViewModelObjectWithProps( response, vmNodes );
            return response;
        } );
    }
    return AwPromiseService.instance.resolve();
};

/**
 * Update ViewModelObject from getTableViewModelProperties soa response
 * @param {Object} response - response from soa
 * @param {vmNodes} vmNodes contains ViewModelTree nodes
 */
function updateViewModelObjectWithProps( response, vmNodes ) {
    let adaptedViewModelObjects = [];
    let adaptedVmNodesMap = new Map();
    _.forEach( vmNodes, function( vmNode ) {
        let adaptedObjArr = getAdaptedObjectsSync( [ vmNode ] );
        if ( adaptedObjArr && adaptedObjArr.length > 0 ) {
            adaptedViewModelObjects.push( adaptedObjArr[ 0 ] );
            adaptedVmNodesMap.set( vmNode.uid, adaptedObjArr[ 0 ].uid );
        }
    } );
    if ( adaptedViewModelObjects && adaptedViewModelObjects.length > 0 ) {
        tcViewModelObjectService.processViewModelObjectsFromJsonResponse( adaptedViewModelObjects, response );
    }

    _.forEach( vmNodes, function( vmNode ) {
        let viewModelObject = _.clone( vmNode );
        if( adaptedVmNodesMap.has( vmNode.uid ) ) {
            let adaptedVmo = adaptedViewModelObjects.filter( ( vmo ) => vmo.uid === adaptedVmNodesMap.get( vmNode.uid ) );
            if( adaptedVmo && adaptedVmo.length > 0 ) {
                tcViewModelObjectService.mergeObjects( vmNode, adaptedVmo[ 0 ] );
                vmNode.uid = viewModelObject.uid;
                vmNode.type = viewModelObject.type;
            }
        }
    } );
}

/**
 * Makes sure the displayName on the ViewModelTreeNode is the same as the Column 0 ViewModelProperty
 * @param {Object} eventData Contains viewModelObjects and modifiedObjects
 * @param {Object} propColumns Contains column details from props
 */
export let updateDisplayNames = function( eventData, propColumns ) {
    let _firstColumnPropertyName =  propColumns && propColumns.length > 0  ? propColumns[ 0 ].propertyName : null;
    if( eventData && eventData.viewModelObjects ) {
        _.forEach( eventData.viewModelObjects, function( updatedVMO ) {
            treeTableDataService.updateVMODisplayName( updatedVMO, _firstColumnPropertyName );
        } );
    }
    if( eventData && eventData.modifiedObjects && eventData.vmc ) {
        var loadedVMObjects = eventData.vmc.loadedVMObjects;
        _.forEach( eventData.modifiedObjects, function( modifiedObject ) {
            let modifiedVMOs = getModifiedObjectsFromAdaptedObjects( loadedVMObjects, modifiedObject );
            _.forEach( modifiedVMOs, function( modifiedVMO ) {
                treeTableDataService.updateVMODisplayName( modifiedVMO, _firstColumnPropertyName );
            } );
        } );
    }
};

const getModifiedObjectsFromAdaptedObjects = function( loadedVMObjects, modifiedObject ) {
    let modifiedVMOs = [];
    _.forEach( loadedVMObjects, function( vmoObject ) {
        let adaptedVmo = {};
        let adaptedObjArr = getAdaptedObjectsSync( [ vmoObject ] );
        if ( adaptedObjArr && adaptedObjArr.length > 0 ) {
            adaptedVmo = adaptedObjArr[0];
            if( adaptedVmo.uid === modifiedObject.uid ) {
                modifiedVMOs.push( vmoObject );
            }
        }
    } );
    return modifiedVMOs;
};

export let handleSelection = function( selectionModel, selectedObjects, isTreeMode ) {
    let currentSelections = selectionModel.getSelection();
    let selectedIds = [];
    let selectedUids = [];
    if( currentSelections && currentSelections.length > 0 ) {
        currentSelections.forEach( ( selection = '' ) => {
            selectedIds.push( selection.split( ',' )[ 0 ] );
        } );
    }
    if( selectedObjects && selectedObjects.length > 0 ) {
        selectedObjects.forEach( ( selection ) => {
            var targetObj = _.get( selection, 'props.awp0Target' );
            let currentUid = isTreeMode ? targetObj.dbValue : selection.uid;
            if( targetObj && targetObj.dbValue && selectedIds.includes( currentUid ) ) {
                let targetUid = isTreeMode ? selection.uid : targetObj.dbValue;
                selectedUids.push( targetUid );
            }
        } );
    } else if( selectedIds.length > 0 ) {
        selectedUids.push( ...currentSelections );
    }
    selectionModel.setSelection( selectedUids );
};

export let loadDataFocusAction = async() => {
    return AwPromiseService.instance.resolve();
};

export default {
    awObjectSetTreeRenderFunction,
    loadObjectSetDataForTree,
    createVMNodeUsingObjectInfo,
    loadColumns,
    getAttributesToInflate,
    initializeObjectSetTreeData,
    arrangeObjectSetColumns,
    handleCdmEventForTree,
    updateTotalFoundOnObjectSetState,
    updateObjectSetTreeTableColumns,
    getTableViewModelProperties,
    updateDisplayNames,
    handleSelection,
    loadDataFocusAction
};
