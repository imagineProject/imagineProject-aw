// Copyright (c) 2021 Siemens
import { createComponent } from 'js/declViewModelService';
import { DerivedStateResult } from 'js/derivedContextService';
import { isObjectSetSourceDCP, initDataProviderRef, generateGridIdForObjectset, getSortCriteria, resetObjectSetCount } from 'js/xrtUtilities';
import { getAdaptedObjectsSync } from 'js/adapterService';
import AwCompare2 from 'viewmodel/AwCompare2ViewModel';
import AwSplmTable from 'viewmodel/AwSplmTableViewModel';
import columnArrangeSvc from 'js/columnArrangeService';
import _ from 'lodash';

export const getDynamicTableComponent = function( vmDef, prop ) {
    return [ new DerivedStateResult( {
        ctxParameters: [],
        additionalParameters: [ prop.columns, prop.objectSetData, prop.objectSetUri, prop.isCompareTable, prop.editContextKey, prop.isRefreshAllObjectSets, prop.enablePropEdit, prop.parentUid ],
        compute: ( renderContext, columns, objectSetData, objectSetUri, isCompareTable, editContextKey, isRefreshAllObjectSets, enablePropEdit, parentUid ) => {
            // dataproviders, columnproviders, actions, functions, messages, i18n, onEvent, grids, editHandlers?
            const uniqueName = objectSetData.id;
            const dpName = `${uniqueName}_Provider`;
            const uniqueGridId = `${generateGridIdForObjectset( editContextKey )}${dpName}${isCompareTable ? '_compare' : ''}`;
            const dp = {
                action: 'loadObjectSetData',
                commandsAnchor: 'com.siemens.splm.clientfx.ui.modelObjectDataGridActionCommands',
                filterFacetAction: `${dpName}_getFilterFacetValues`,
                filterFacetResults: '{{data._filterFacetResults}}',
                isObjectSetSourceDCP: isObjectSetSourceDCP( objectSetData.source ),
                response: `{{data._${dpName}_searchResults}}`,
                selectionModelMode: 'multiple',
                totalFound: `{{data._${dpName}_totalFound}}`,
                editContext: editContextKey,
                enablePropEdit: enablePropEdit,
                inputData: {
                    selectionData: '{{props.selectionData}}',
                    selectionModel: '{{props.selectionModel}}'
                }
            };

            const cpName = `${uniqueName}_ColumnProvider`;

            let gridInfo = prop.gridInfo || {};
            _.forEach( columns, ( column ) => {
                column.enableColumnHiding = gridInfo.enableArrangeMenu === true;
            } );

            let sortCriteria = getSortCriteria( objectSetData, columns );

            const cp = {
                sortCriteria: sortCriteria,
                columns: [],
                saveColumnAndLoadAction: `${dpName}_saveColumnConfigLoadData`,
                saveColumnAction: `${dpName}_saveColumnConfig`,
                resetColumnAction: `${dpName}_resetColumnConfig`,
                objectSetUri: objectSetUri,
                columnConfig: {
                    columnConfigId: objectSetUri,
                    operationType: '{{props.operationType}}',
                    columns: columns
                }
            };

            const grid = {
                dataProvider: dpName,
                columnProvider: cpName,
                enableArrangeMenu: gridInfo.enableArrangeMenu === true,
                gridOptions: {
                    enableExpandAndPaginationInEdit: true, // This is always returned true
                    enableGridMenu: gridInfo.gridOptions && gridInfo.gridOptions.enableGridMenu === true,
                    enableSorting: true, // This is always returned true
                    isFilteringEnabled: gridInfo && gridInfo.gridOptions && gridInfo.gridOptions.isFilteringEnabled === true
                }
            };

            // default setup
            const viewModel = {
                dataProviders: {},
                columnProviders: {},
                actions: {
                    startEditForNewVmos: {
                        actionType: 'JSFunction',
                        method: 'startEditForNewVmos',
                        inputData: {
                            editContext: editContextKey
                        },
                        deps: 'js/editEventsService'
                    },
                    initialize: {
                        actionType: 'JSFunction',
                        method: 'initialize',
                        deps: 'js/AwObjectSetTableService',
                        inputData: {
                            dataProvider: `{{data.dataProviders.${dpName}}}`,
                            columnProvider: `{{data.grids.${uniqueGridId}.columnProviderInstance}}`,
                            dpRef: '{{props.dpRef}}',
                            objectSetSource: '{{props.objectSetData.source}}'
                        }
                    },
                    cleanup: {
                        actionType: 'JSFunction',
                        method: 'cleanup',
                        deps: 'js/AwObjectSetTableService',
                        inputData: {
                            dataProvider: `{{data.dataProviders.${dpName}}}`,
                            dpRef: '{{props.dpRef}}',
                            selectionData: '{{props.selectionData}}',
                            objectSetState: '{{props.objectSetState}}'
                        }
                    },
                    initializeDataProvider: {
                        actionType: 'dataProvider',
                        method: `${dpName}`
                    },
                    doArrangeEvent: {
                        actionType: 'JSFunctionAsync',
                        method: 'arrangeObjectSetColumns',
                        inputData: {
                            eventData: '{{data.eventData}}',
                            gridId: `${uniqueGridId}`,
                            viewModel: '{{data}}',
                            objSetUri: objectSetUri,
                            isCompareTable: '{{props.isCompareTable}}',
                            xrtContext: '{{props.xrtContext}}',
                            vmo: '{{props.vmo}}'
                        },
                        outputData: {},
                        deps: 'js/AwObjectSetTableService'
                    },
                    refreshDataProvider: {
                        actionType: 'JSFunction',
                        method: 'refreshDataProvider',
                        inputData: {
                            dataProvider: `{{data.dataProviders.${dpName}}}`,
                            eventData: '{{data.eventData}}',
                            objectSetSource: '{{props.objectSetData.source}}',
                            vmo: '{{props.vmo}}',
                            isRefreshAllObjectSets: isRefreshAllObjectSets
                        },
                        deps: 'js/xrtUtilities'
                    },
                    refreshObjSetTable: {
                        actionType: 'Event',
                        method: 'Event',
                        inputData: {
                            events: [ {
                                name: `${uniqueGridId}.plTable.clientRefresh`
                            } ]
                        }
                    }
                },
                messages: {
                    partialErrors: {
                        messageText: 'error',
                        messageTextParams: [
                            '{{data._partialErrors[0].errorValues[0].message}}'
                        ],
                        messageType: 'ERROR'
                    }
                },
                i18n: {
                    error: [
                        'XRTMessages'
                    ]
                },
                functions: {
                    getActiveWorkspaceXrtContext: {
                        functionName: 'getActiveWorkspaceXrtContext',
                        parameters: [
                            '{{props.xrtContext}}'
                        ],
                        deps: 'js/xrtUtilities'
                    }
                },
                onEvent: [ {
                    eventId: `${dpName}.startEditForNewVmosRequested`,
                    action: 'startEditForNewVmos'
                },
                {
                    eventId: 'cdm.relatedModified',
                    action: 'refreshDataProvider',
                    cacheEventData: true
                },
                {
                    eventId: 'columnArrange',
                    cacheEventData: true,
                    action: 'doArrangeEvent'
                }
                ],
                grids: {},
                lifecycleHooks: {
                    onMount: 'initialize',
                    onUnmount: 'cleanup',
                    onUpdate: [ {
                        action: 'refreshObjSetTable',
                        observers: [ 'props.showCheckBox' ]
                    } ]
                }
            };
            // Now setup specific named elements
            // dp, cp, grid
            viewModel.dataProviders[ dpName ] = dp;
            viewModel.columnProviders[ cpName ] = cp;
            viewModel.grids[ uniqueGridId ] = grid;

            // action message that is repeated
            const failureActionMessage = {
                failure: [ {
                    message: 'partialErrors'
                } ]
            };

            const searchResultsName = `_${dpName}_searchResults`;
            const totalFoundName = `_${dpName}_totalFound`;

            let colsToInflate = [];
            _.forEach( columns, function( uwColumnInfo ) {
                if( ( uwColumnInfo.field || uwColumnInfo.propertyName ) && uwColumnInfo.hiddenFlag !== true ) {
                    colsToInflate.push( uwColumnInfo.field || uwColumnInfo.propertyName );
                }
            } );

            let adaptedVmo = {};
            let adaptedObjArr = getAdaptedObjectsSync( [ prop.vmo ] );
            if( adaptedObjArr && adaptedObjArr.length > 0 ) {
                adaptedVmo = adaptedObjArr[0];
            }

            let loadObjectSetData = {
                actionType: 'JSFunction',
                method: 'loadObjectSetData',
                inputData: {
                    firstPageUids: '{{props.firstPageUids}}',
                    objectSetInfo: '{{props.objectSetInfo}}',
                    firstPageResults: '{{data._ObjectSet_Provider_searchResults}}',
                    objectSetUri: '{{props.objectSetUri}}',
                    columns: '{{props.columns}}',
                    initialOperationType: '{{props.operationType}}',
                    updatedOperationType: `{{data.dataProviders.${dpName}.columnConfig.operationType}}`,
                    columnFilters: `{{data.columnProviders.${cpName}.columnFilters}}`,
                    xrtContext: '{{props.xrtContext}}',
                    objectSetData: '{{props.objectSetData}}',
                    vmo: '{{props.vmo}}',
                    sortCriteria: `{{data.columnProviders.${cpName}.sortCriteria}}`,
                    startIndex: `{{data.dataProviders.${dpName}.startIndex}}`,
                    colsToInflate: colsToInflate,
                    reload: '{{props.reload}}',
                    objectSetState: '{{props.objectSetState}}',
                    totalFound: '{{props.totalFound}}',
                    parentUid: parentUid
                },
                outputData: {
                    _ObjectSet_Provider_searchResults: 'firstPageObjs',
                    _ObjectSet_Provider_totalFound: 'totalFound'
                },
                deps: 'js/xrtUtilities'
            };

            const providerConfigName = `dataProviders.${dpName}.columnConfig`;
            loadObjectSetData.outputData[ searchResultsName ] = 'firstPageObjs';
            loadObjectSetData.outputData[ totalFoundName ] = 'totalFound';
            loadObjectSetData.outputData[ providerConfigName ] = `{{function:${dpName}_getValidColumnConfig}}`;

            viewModel.actions.loadObjectSetData = loadObjectSetData;

            viewModel.actions[ `${dpName}_getFilterFacetValues` ] = {
                actionType: 'TcSoaService',
                method: 'getFilterValues',
                serviceName: 'Internal-AWS2-2019-12-Finder',
                deps: 'js/xrtUtilities',
                inputData: {
                    filterFacetInput: {
                        columnFilters: '{{filterFacetInput.columnFilters}}',
                        columnName: '{{filterFacetInput.column.field}}',
                        maxToReturn: 50,
                        providerName: 'Awp0ObjectSetRowProvider',
                        searchCriteria: {
                            'ActiveWorkspace:xrtContext': '{{function:getActiveWorkspaceXrtContext}}',
                            objectSet: objectSetData.source,
                            parentUid: parentUid,
                            showConfiguredRev: objectSetData.showConfiguredRev
                        },
                        startIndex: '{{filterFacetInput.startIndex}}'
                    }
                },
                outputData: {
                    _filterFacetResults: '{{json:facetValues}}',
                    _partialErrors: 'ServiceData.partialErrors'
                },
                actionMessages: failureActionMessage
            };

            // load data action
            let loadDataAction = {
                actionType: 'JSFunctionAsync',
                method: 'basePerformSearchViewModel',
                deps: 'js/tcDataManagementService',
                inputData: {
                    0: {
                        columnConfigInput: {
                            clientName: 'AWClient',
                            clientScopeURI: objectSetUri,
                            operationType: `{{data.dataProviders.${dpName}.columnConfig.operationType}}`
                        },
                        inflateProperties: true,
                        searchInput: {
                            columnFilters: `{{data.columnProviders.${cpName}.columnFilters}}`,
                            maxToLoad: 50,
                            maxToReturn: 50,
                            providerName: 'Awp0ObjectSetRowProvider',
                            searchCriteria: {
                                'ActiveWorkspace:Location': '{{ctx.locationContext.ActiveWorkspace:Location}}',
                                'ActiveWorkspace:SubLocation': '{{ctx.locationContext.ActiveWorkspace:SubLocation}}',
                                'ActiveWorkspace:xrtContext': '{{function:getActiveWorkspaceXrtContext}}',
                                isRedLineMode: '{{ctx.isRedLineMode}}',
                                objectSet: objectSetData.source,
                                parentUid: parentUid,
                                showConfiguredRev: objectSetData.showConfiguredRev
                            },
                            searchSortCriteria: `{{data.columnProviders.${cpName}.sortCriteria}}`,
                            startIndex: `{{data.dataProviders.${dpName}.startIndex}}`,
                            attributesToInflate: colsToInflate
                        }
                    }
                },
                outputData: {
                    'ctx.searchResponseInfo.columnConfig': `{{function:${dpName}_getValidColumnConfig}}`,
                    _partialErrors: 'ServiceData.partialErrors'
                },
                actionMessages: failureActionMessage
            };
            loadDataAction.outputData[ searchResultsName ] = '{{json:searchResultsJSON}}';
            loadDataAction.outputData[ totalFoundName ] = 'totalFound';
            loadDataAction.outputData[ providerConfigName ] = `{{function:${dpName}_getValidColumnConfig}}`;

            viewModel.actions[ `${dpName}_loadData` ] = loadDataAction;

            let saveColumnConfigLoadData = {
                actionType: 'JSFunctionAsync',
                method: 'basePerformSearchViewModel',
                deps: 'js/tcDataManagementService',
                inputData: {
                    0: {
                        columnConfigInput: {
                            clientName: 'AWClient',
                            clientScopeURI: objectSetUri,
                            operationType: '{{eventData.operationType}}'
                        },
                        inflateProperties: true,
                        saveColumnConfigData: {
                            clientScopeURI: objectSetUri,
                            columnConfigId: `{{data.dataProviders.${dpName}.columnConfig.columnConfigId}}`,
                            columns: `{{function:${dpName}_getObjSetColumns}}`,
                            scope: 'LoginUser',
                            scopeName: ''
                        },
                        searchInput: {
                            columnFilters: `{{data.columnProviders.${cpName}.columnFilters}}`,
                            maxToLoad: 50,
                            maxToReturn: 50,
                            providerName: 'Awp0ObjectSetRowProvider',
                            searchCriteria: {
                                'ActiveWorkspace:Location': '{{ctx.locationContext.ActiveWorkspace:Location}}',
                                'ActiveWorkspace:SubLocation': '{{ctx.locationContext.ActiveWorkspace:SubLocation}}',
                                'ActiveWorkspace:xrtContext': '{{function:getActiveWorkspaceXrtContext}}',
                                isRedLineMode: '{{ctx.isRedLineMode}}',
                                objectSet: objectSetData.source,
                                parentUid: parentUid,
                                showConfiguredRev: objectSetData.showConfiguredRev
                            },
                            searchSortCriteria: `{{data.columnProviders.${cpName}.sortCriteria}}`,
                            startIndex: `{{data.dataProviders.${dpName}.startIndex}}`
                        }
                    }
                },
                outputData: {
                    'ctx.searchResponseInfo.columnConfig': `{{function:${dpName}_getValidColumnConfig}}`,
                    _partialErrors: 'ServiceData.partialErrors'
                },
                actionMessages: failureActionMessage
            };

            saveColumnConfigLoadData.outputData[ searchResultsName ] = '{{json:searchResultsJSON}}';
            saveColumnConfigLoadData.outputData[ totalFoundName ] = 'totalFound';
            saveColumnConfigLoadData.outputData._refreshComp = true;
            saveColumnConfigLoadData.outputData[ providerConfigName ] = `{{function:${dpName}_getValidColumnConfig}}`;

            viewModel.actions[ `${dpName}_saveColumnConfigLoadData` ] = saveColumnConfigLoadData;

            let saveColumnConfig = {
                actionType: 'JSFunctionAsync',
                method: 'basePerformSearchViewModel',
                deps: 'js/tcDataManagementService',
                inputData: {
                    0: {
                        columnConfigInput: {
                            clientName: 'AWClient',
                            clientScopeURI: objectSetUri,
                            operationType: `{{data.dataProviders.${dpName}.columnConfig.operationType}}`
                        },
                        inflateProperties: false,
                        noServiceData: true,
                        saveColumnConfigData: {
                            clientScopeURI: objectSetUri,
                            columnConfigId: `{{data.dataProviders.${dpName}.columnConfig.columnConfigId}}`,
                            columns: `{{function:${dpName}_getObjSetColumns}}`,
                            scope: 'LoginUser',
                            scopeName: ''
                        },
                        searchInput: {
                            columnFilters: `{{data.columnProviders.${cpName}.columnFilters}}`,
                            maxToLoad: 50,
                            maxToReturn: 50,
                            providerName: 'Awp0ObjectSetRowProvider',
                            searchCriteria: {
                                'ActiveWorkspace:Location': '{{ctx.locationContext.ActiveWorkspace:Location}}',
                                'ActiveWorkspace:SubLocation': '{{ctx.locationContext.ActiveWorkspace:SubLocation}}',
                                'ActiveWorkspace:xrtContext': '{{function:getActiveWorkspaceXrtContext}}',
                                isRedLineMode: '{{ctx.isRedLineMode}}',
                                objectSet: objectSetData.source,
                                parentUid: parentUid,
                                showConfiguredRev: objectSetData.showConfiguredRev
                            },
                            searchSortCriteria: `{{data.columnProviders.${cpName}.sortCriteria}}`,
                            startIndex: `{{data.dataProviders.${dpName}.startIndex}}`
                        }
                    }
                },
                actionMessages: failureActionMessage
            };

            viewModel.actions[ `${dpName}_saveColumnConfig` ] = saveColumnConfig;

            let resetColumnConfig = {
                actionType: 'JSFunctionAsync',
                method: 'baseGetOrResetUIColumnConfigs',
                deps: 'js/tcDataManagementService',
                inputData: {
                    0: {
                        getOrResetUiConfigsIn: [ {
                            clientName: 'clientName',
                            columnConfigQueryInfos: [ {
                                clientScopeURI: objectSetUri,
                                columnsToExclude: [],
                                operationType: 'configured',
                                typeNames: [
                                    'WorkspaceObject'
                                ]
                            } ],
                            resetColumnConfig: true,
                            scope: 'LoginUser',
                            scopeName: ''
                        } ]
                    }
                },
                outputData: {},
                actionMessages: failureActionMessage,
                events: {
                    success: []
                }
            };

            if( !objectSetUri.startsWith( 'objSetSrc_' ) ) {
                resetColumnConfig.events.success.push( {
                    name: `${uniqueGridId}.plTable.reload`
                } );
            } else {
                resetColumnConfig.events.success.push( {
                    name: 'cdm.relatedModified',
                    eventData: {
                        refreshLocationFlag: true,
                        relatedModified: [
                            '{{props.vmo}}'
                        ]
                    }
                } );
            }

            resetColumnConfig.outputData[ `dataProviders.${dpName}.columnConfig` ] = 'columnConfigurations[0].columnConfigurations[0]';
            viewModel.actions[ `${dpName}_resetColumnConfig` ] = resetColumnConfig;

            // functions
            viewModel.functions[ `${dpName}_getValidColumnConfig` ] = {
                functionName: 'getValidColumnConfig',
                parameters: [
                    `{{data.dataProviders.${dpName}.columnConfig}}`
                ],
                deps: 'js/xrtUtilities'
            };
            viewModel.functions[ `${dpName}_getObjSetColumns` ] = {
                functionName: 'getObjSetColumns',
                parameters: [
                    `{{data.dataProviders.${dpName}.newColumns}}`,
                    `{{data.columnProviders.${cpName}.columnConfig.columns}}`
                ],
                deps: 'js/xrtUtilities'
            };

            const Component = createComponent( viewModel, ( { viewModel, showCheckBox, gridId, isCompareTable, subPanelContext } ) => {
                if( isCompareTable ) {
                    return <AwCompare2 {...viewModel.grids[`${gridId}_compare`]}></AwCompare2>;
                }
                return <AwSplmTable {...viewModel.grids[gridId]} showContextMenu={true} showCheckBox={showCheckBox} commandContext={subPanelContext}></AwSplmTable>;
            } );
            Component.displayName = 'AwDynamicTable';
            return Component;
        }
    } ) ];
};

export const initialize = ( dataProvider, columnProvider, dpRef, objectSetSource ) => {
    if( dataProvider ) {
        if( dataProvider && objectSetSource ) {
            dataProvider.setValidSourceTypes( objectSetSource );
        }

        if( !dpRef ) {
            return;
        }

        initDataProviderRef( dpRef );
        dpRef.current.dataProviders.push( dataProvider.viewModelCollection.getLoadedViewModelObjects );

        dpRef.current.columnProviders[ dataProvider.name ] = {
            getColumnFilters: columnProvider.getColumnFilters,
            getSortCriteria: columnProvider.getSortCriteria,
            getColumns: columnProvider.getColumns
        };
    }
};

export const cleanup = ( dataProvider, dpRef, selectionData, objectSetState ) => {
    if( dataProvider && dpRef?.current ) {
        if( dataProvider.viewModelCollection && dpRef.current.dataProviders?.includes( dataProvider.viewModelCollection.getLoadedViewModelObjects ) ) {
            const index = dpRef.current.dataProviders.indexOf( dataProvider.viewModelCollection.getLoadedViewModelObjects );
            if( index > -1 ) {
                dpRef.current.dataProviders.splice( dataProvider.viewModelCollection.getLoadedViewModelObjects, 1 );
            }
        }

        const dpName = dataProvider.name;
        if( dpRef.current.columnProviders && dpRef.current.columnProviders[ dpName ] ) {
            delete dpRef.current.columnProviders[ dpName ];
        }

        resetObjectSetCount( objectSetState );
    }
};

export const arrangeObjectSetColumns = ( eventData, uniqueGridId, viewModel, objectSetUri, isCompareTable, xrtContext, vmo ) => {
    let dpNameIn = eventData.name.includes( '_Provider' ) ? eventData.name : eventData.name + '_Provider';
    if( uniqueGridId && uniqueGridId === dpNameIn || eventData.objectSetUri === objectSetUri ) {
        // sync up eventData name with dataProvider name, only for table
        if( !isCompareTable && eventData.objectSetUri === objectSetUri ) {
            eventData.name = uniqueGridId;
        }
        eventData.props = {
            xrtContext: xrtContext,
            vmo: vmo
        };
        columnArrangeSvc.arrangeColumns( viewModel, eventData );
    }
};

export const awObjectSetTableRenderFunction = function( props ) {
    let {
        subPanelContext,
        showCheckBox,
        ctxMin: { dynamicTable },
        firstPageUids,
        selectionData,
        selectionModel,
        dpRef,
        isCompareTable,
        vmo,
        selectAll,
        objectSetData,
        operationType,
        objectSetInfo,
        objectSetUri,
        columns,
        xrtContext,
        activeObjectSetState,
        reload,
        editContextKey,
        isRefreshAllObjectSets,
        objectSetState,
        totalFound,
        gridInfo,
        enablePropEdit,
        parentUid
    } = props;
    let AwDynamicTable = dynamicTable[ 0 ];
    const gridId = `${generateGridIdForObjectset( editContextKey )}${objectSetData.id}_Provider`;
    return <AwDynamicTable
        gridId={gridId}
        showCheckBox={showCheckBox}
        selectAll={selectAll}
        subPanelContext={subPanelContext}
        firstPageUids={firstPageUids}
        selectionData={selectionData}
        selectionModel={selectionModel}
        dpRef={dpRef}
        vmo={vmo}
        isCompareTable={isCompareTable}
        objectSetData={objectSetData}
        operationType={operationType}
        objectSetInfo={objectSetInfo}
        objectSetUri={objectSetUri}
        columns={columns}
        xrtContext={xrtContext}
        activeObjectSetState={activeObjectSetState}
        reload={reload}
        editContextKey={editContextKey}
        isRefreshAllObjectSets={isRefreshAllObjectSets}
        objectSetState={objectSetState}
        totalFound={totalFound}
        gridInfo={gridInfo}
        enablePropEdit={enablePropEdit}
        parentUid={parentUid}>
    </AwDynamicTable>;
};

export default {
    getDynamicTableComponent,
    initialize,
    awObjectSetTableRenderFunction,
    cleanup,
    arrangeObjectSetColumns
};
