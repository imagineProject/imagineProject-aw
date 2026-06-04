// Copyright (c) 2022 Siemens

/**
 * @module js/Cm1ImpactedWidgetService
 */
import AwPromiseService from 'js/awPromiseService';
import cmUtils from 'js/changeMgmtUtils';
import clientDataModelSvc from 'soa/kernel/clientDataModel';
import awTableTreeSvc from 'js/splmTablePublishedTreeService';
import soaSvc from 'soa/kernel/soaService';
import appCtxSvc from 'js/appCtxService';
import awColumnSvc from 'js/awColumnService';
import propertyPolicySvc from 'soa/kernel/propertyPolicyService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import iconSvc from 'js/iconService';
import colorDecoratorSvc from 'js/colorDecoratorService';
import tcVmoService from 'js/tcViewModelObjectService';
import tcDataMgmtService from 'js/tcDataManagementService';
import messageSvc from 'js/messagingService';
import localeSvc from 'js/localeService';
import eventBus from 'js/eventBus';
import localStrg from 'js/localStorage';
import cdm from 'soa/kernel/clientDataModel';

import _ from 'lodash';
import parsingUtils from 'js/parsingUtils';

var exports = {};
var listenForsublocationChange;

export let getChangeObjectUid = function() {
    var changeObjectUid = '';
    var selectedVmo = appCtxSvc.ctx.currentChange !== undefined ? appCtxSvc.ctx.currentChange : appCtxSvc.ctx.selected;

    if ( appCtxSvc.ctx.currentChange === undefined ) {
        if ( appCtxSvc.ctx.selected.type === 'ChangeRequestRevision' || appCtxSvc.ctx.selected.type === 'ChangeNoticeRevision' ) {
            appCtxSvc.registerCtx( 'currentChange', appCtxSvc.ctx.selected );
        }
    }
    if ( selectedVmo.modelType && ( selectedVmo.modelType.typeHierarchyArray.indexOf( 'ChangeNoticeRevision' ) > -1 || selectedVmo.modelType.typeHierarchyArray.indexOf( 'ChangeRequestRevision' ) > -1 ) ) {
        changeObjectUid = selectedVmo.uid;
    } else {
        selectedVmo = appCtxSvc.ctx.pselected;

        if ( selectedVmo.modelType && ( selectedVmo.modelType.typeHierarchyArray.indexOf( 'ChangeNoticeRevision' ) > -1 || selectedVmo.modelType.typeHierarchyArray.indexOf( 'ChangeRequestRevision' ) > -1 ) ) {
            changeObjectUid = selectedVmo.uid;
        }
    }
    return changeObjectUid;
};

/**
 * This function will call action event from Impact Analysis
 * @param {commandId} commandId - Command ID for which action has to be triggered
 *
 */
export let publishAddImpactedFromCommandViewModel = function( commandId ) {
    var eventId;
    if ( commandId === 'Cm1AddImpactedItemsCommand' ) {
        eventId = 'createImpactedRelationSoaCall.probableImpactedTable';
    } else if ( commandId === 'Cm1AddRelatedImpactedItemsCommand' ) {
        eventId = 'createImpactedRelationObjectsSoaCall.relatedObjectTable';
    } else if ( commandId === 'Cm1AddImpactedRBCommand' ) {
        eventId = 'createImpactedRelationSoaCallForRelationBrowser.relationBrowser';
    }
    eventBus.publish( eventId, {
        commandId: commandId
    } );
};

/**
 * This function will call action event to set relation context
 * before calling cut Operation for removing Impacted Items in Relation View.
 * This is required because in Relation View , when graph is selected/deselected and
 * then cut operation is called , relation context is lost due to relation browser redefining it.
 * @param {*} commandId
 */
export let publishCutRelationFromCommandViewModel = function( commandId ) {
    if ( commandId === 'Cm1RemoveImpactedItemsCommand' && appCtxSvc.ctx.relationContext === undefined ) {
        eventBus.publish( 'cutRelationForPersistedSelection', {
            commandId: commandId
        } );
    }
};

export let getProblemItemList = function() {
    var updatedChangeObject = clientDataModelSvc.getObject( appCtxSvc.ctx.xrtSummaryContextObject.uid );
    var problemItems = updatedChangeObject.props.cm0ProblemPartRevs;
    var listModels = [];
    // load the list values only if prop has values
    if( problemItems && problemItems.dbValues.length > 0 ) {
        for( var idx = 0; idx < problemItems.dbValues.length; idx++ ) {
            var selectedEntry = false;
            if( idx === 0 ) {
                selectedEntry = true;
            }
            var listModel = {
                propDisplayValue: problemItems.uiValues[ idx ],
                propInternalValue: problemItems.dbValues[ idx ],
                propDisplayDescription: '',
                dbValue: problemItems.dbValues[ idx ],
                dispValue: problemItems.uiValues[ idx ],
                sel: selectedEntry
            };

            listModels.push( listModel );
        }
        listModels.sort( function( a, b ) { return a.propDisplayValue > b.propDisplayValue ? 1 : b.propDisplayValue > a.propDisplayValue ? -1 : 0; } );
        return listModels;
    }
};

/**
 * This will be called when problem item is loaded or selection is changed on drop down
 * We need to load other tables only after LOV is completely loaded. By setting variable problemItemLOVLoaded other tables will start loading.
 * If variable problemItemLOVLoaded is already set than it means its selection change in LOV so just realod probableImpacted table.
 * @param {viewmodeldata} data view model data
 *
 * @return {Promise} Resolved with an object containing the results of the operation.
 */

export let handleProblemItemSelection = function( data ) {
    // Set default view if not set already
    if ( !appCtxSvc.ctx.ImpactsViewMode ) {
        var newView = 'TableView';
        appCtxSvc.registerCtx( 'ImpactsViewMode', newView );
    }
    var currentView = appCtxSvc.ctx.ImpactsViewMode;
    appCtxSvc.registerCtx( 'cursorIDParent', new Map( [] ) );

    //set problem Item on relation browser ctx
    var rootId = {
        rootId: data.selectedProblemItem.dbValue,
        defaultActiveView: 'ChangeImpactAnalysis'
    };
    appCtxSvc.registerCtx( 'initRelationsBrowserCtx', rootId );

    if ( appCtxSvc.ctx.selected.type === 'ChangeRequestRevision' || appCtxSvc.ctx.selected.type === 'ChangeNoticeRevision' ) {
        appCtxSvc.registerCtx( 'currentChange', appCtxSvc.ctx.selected );
    }

    const vmo = cdm.getObject( data.selectedProblemItem.dbValue );
    if ( currentView === 'RelationView' ) {
        eventBus.publish( 'awGraphLegend.activeViewChanged' );
    }
    return vmo;
};

/**
 * This functions reloads impacted candidates table
 * @param {Object} data: view model data
 * @param {Object} configState : configuration state
 * **/
export let reloadProbableImpactedTable = function( data ) {
    var currentView = appCtxSvc.ctx.ImpactsViewMode;
    if ( currentView === 'TableView' ) {
        if ( data.atomicDataRef !== undefined && data.atomicDataRef.cm1ImpactWidgetState !== undefined ) {
            var newCm1ImpactWidgetState = data.atomicDataRef.cm1ImpactWidgetState.getAtomicData();
            if ( newCm1ImpactWidgetState !== undefined ) {
                newCm1ImpactWidgetState.probImpactedLastSingleSelection = '';
                data.atomicDataRef.cm1ImpactWidgetState.setAtomicData( newCm1ImpactWidgetState );
            }
        }
        eventBus.publish( 'probableImpactedGrid.plTable.reload' );
    }
};

/**
* Get probable impacted for selected problem item.

* @param {treeLoadInput} treeLoadInput Tree Load Input
* @param {object} uwDataProvider data provider
* @param {viewmodeldata} data view model data
* @param {Object} props props of componnent
* @param {Object} configState configuration state
* @return {Promise} Resolved with an object containing the results of the operation.
*/

export let loadProbableImpactedTree = function( treeLoadInput, uwDataProvider, inContextData, props, configState ) {
    //var deferred = AwPromiseService.instance.defer();
    let sourceProblemItemUid;
    let selectedEffUID = '';
    let selectedRevRuleUID = '';
    let prodContextId = '';
    var data = { ...inContextData };
    var currentSelection = appCtxSvc.ctx.selected;
    if ( inContextData !== undefined && inContextData.dataProviders.probableImpactedDataProvider !== undefined
        && inContextData.dataProviders.probableImpactedDataProvider.selectedObjects.length > 0 ) {
        currentSelection = appCtxSvc.ctx.currentChange;
    }

    //below if blocks are added for configuring probable impacted candidates,
    //based on- effectivity,revision rule, product context Id.
    if( configState !== undefined && configState.selectedEffUIDs !== undefined && configState.selectedEffUIDs.length > 0 ) {
        configState.selectedEffUIDs.forEach( ( id ) => selectedEffUID = selectedEffUID.concat( id.concat( ',' ) ) );
    }
    selectedEffUID = selectedEffUID.replace( /,\s*$/, '' );

    if( configState !== undefined && configState.selectedRevRuleUID !== undefined && configState.selectedRevRuleUID !== null ) {
        selectedRevRuleUID = configState.selectedRevRuleUID;
    }

    if( configState !== undefined && configState.prodContextIds !== undefined && configState.prodContextIds.length > 0 ) {
        configState.prodContextIds.forEach( ( id ) => prodContextId = prodContextId.concat( id.concat( ',' ) ) );
    }
    prodContextId = prodContextId.replace( /,\s*$/, '' );

    if (  !isCurrentSelectionChange( currentSelection ) ) {
        if ( currentSelection !== undefined && currentSelection !== null ) {
            if ( currentSelection.props !== undefined
                && currentSelection.props.awb0UnderlyingObject !== undefined && currentSelection.props.awb0UnderlyingObject.dbValues !== undefined ) {
                sourceProblemItemUid = currentSelection.props.awb0UnderlyingObject.dbValues[0];
            } else if ( currentSelection.uid !== undefined ) {
                sourceProblemItemUid = currentSelection.uid;
            }
        }
        if ( appCtxSvc.ctx.cursorIDParent === undefined ) {
            appCtxSvc.registerCtx( 'cursorIDParent', new Map( [] ) );
        }
    }
    // if ( data.dataProviders.probableImpactedDataProvider !== undefined && data.dataProviders.probableImpactedDataProvider.selectedObjects !== undefined
    //     && data.dataProviders.probableImpactedDataProvider.selectedObjects.length === 0 ) {
    //     if ( probableImpactedTableSelection.length !== 0 ) {
    //         var topNode = data.dataProviders.probableImpactedDataProvider.getItemAtIndex( 0 );
    //         if ( topNode !== undefined && topNode !== null ) {
    //             data.dataProviders.probableImpactedDataProvider.selectionModel.setSelection( topNode );
    //         }
    //     }
    // }

    treeLoadInput.displayMode = 'Tree';

    //If item is selected from drop down or probable impacted table
    var isProblemItemNode = treeLoadInput.parentNode.levelNdx === -1;
    if ( sourceProblemItemUid === undefined ) {
        if( props.selectedProblemItem !== undefined ) {
            sourceProblemItemUid = props.selectedProblemItem;
        } else {
            if( currentSelection ) {
                sourceProblemItemUid = currentSelection.uid;
            }
        }
    }

    //If item is selected/expanded from probable impacted table,then get the problem item uid
    if ( !isProblemItemNode ) {
        if ( treeLoadInput.startChildNdx > 0 ) {
            treeLoadInput = processTreeLoadInputForNextPageLoad( treeLoadInput );
        }
        sourceProblemItemUid = treeLoadInput.parentNode.props.cm0ProposedImpactedObject.dbValues[0];
    }
    var treeLevel = treeLoadInput.parentNode.levelNdx + 1; // For problem item from dropdown levelNdx is -1. We are sending "0" if problem item from dropdown is selected.
    var levelString = treeLevel.toString();
    let changeObjectUid;
    if( props.changeObject !== undefined ) {
        changeObjectUid = props.changeObject.uid;
    }
    var returnSourceObject = 'False';
    var returnParentItems = 'False';
    var returnRelatedItems = 'False';

    if( levelString === '0' ) {
        returnSourceObject = 'True';
    } else {
        returnParentItems = 'True';
    }

    var clientScopeURI = 'CMProbableImpactedTable';
    if ( currentSelection !== undefined && currentSelection !== null && !isCurrentSelectionChange( currentSelection ) ) {
        clientScopeURI = 'ParentTraversalTable';
    }

    //Set on Data which will ne used in case of reset or update column configuration
    if ( clientScopeURI !== undefined && clientScopeURI !== null && inContextData ) {
        inContextData.clientScopeURI = clientScopeURI;
    }

    let parentNode = treeLoadInput.parentNode;

    // Set related usage ids and parent ids
    let relatedUsageUids = '';
    if( parentNode.props !== undefined && parentNode.props.cm0RelatedUsageRevs !== undefined && parentNode.props.cm0RelatedUsageRevs.dbValues.length > 0 ) {
        parentNode.props.cm0RelatedUsageRevs.dbValues.forEach( ( id ) => relatedUsageUids = relatedUsageUids.concat( id.concat( ',' ) ) );
    }

    let relatedParentUids = '';
    if( parentNode.props !== undefined && parentNode.props.cm0RelatedParentRevs !== undefined && parentNode.props.cm0RelatedParentRevs.dbValues.length > 0 ) {
        parentNode.props.cm0RelatedParentRevs.dbValues.forEach( ( id ) => relatedParentUids = relatedParentUids.concat( id.concat( ',' ) ) );
    }
    let endObjectUid = '';
    let startObjectUid = '';
    if( treeLoadInput.cursorNodeId !== '' && treeLoadInput.cursorNodeId !== null ) {
        startObjectUid = treeLoadInput.parentNode.cursorObject.firstObjectUID;
        endObjectUid = treeLoadInput.parentNode.cursorObject.lastObjectUID;
    }
    //Prepare SOA input
    let soaInput = {
        columnConfigInput: {
            clientName: 'AWClient',
            clientScopeURI: clientScopeURI
        },
        inflateProperties: true,
        searchInput: {
            maxToLoad: 50,
            maxToReturn: 50,
            providerName: 'Cm1ImpactAnalysisProvider',
            searchFilterMap6: {},
            searchCriteria: {
                dcpSortByDataProvider: 'true',
                parentUid: sourceProblemItemUid,
                efffectivityUid: selectedEffUID,
                revisionRuleUid: selectedRevRuleUID,
                productContextId: prodContextId,
                changeObjectUid: changeObjectUid,
                returnSourceObject: returnSourceObject,
                returnParentItems: returnParentItems,
                returnRelatedItems: returnRelatedItems,
                level: levelString,
                relatedUsageUids: relatedUsageUids,
                relatedParentUids: relatedParentUids,
                endObjectUid: endObjectUid,
                startObjectUid: startObjectUid
            },
            searchFilterFieldSortType: 'Alphabetical',
            searchSortCriteria: data.columnProviders.probableImpactedColumnProvider.sortCriteria,
            startIndex: treeLoadInput.startChildNdx
        }
    };

    let policyJson = {
        types: [ {
            name: 'Cm0ProposedImpactedObject',
            properties: [ {
                name: 'cm0IsAlreadyImpacted'
            },
            {
                name: 'cm0SourceObject'
            },
            {
                name: 'cm0Relation'
            },
            {
                name: 'cm0ProposedImpactedObject',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            },
            {
                name: 'cm0ProposedImpactedType'
            },
            {
                name: 'awp0CellProperties'
            },
            {
                name: 'cm0HasChildren'
            },
            {
                name: 'cm0Children'
            },
            {
                name: 'cm0UsageRevision'
            },
            {
                name: 'cm0RelatedUsageRevs'
            },
            {
                name: 'cm0RelatedParentRevs'
            }
            ]
        } ]
    };

    return buildTreeTableStructure( treeLoadInput, soaInput, data, uwDataProvider, policyJson, props );
};

/**
 * This function will create treeloadInput for next page load.
 * This treeloadInput will have updated correct parent node(if required),
 * updated start index based on current parent node instead of tree structure as whole.
 * treeLoadInput will also have updated startChildId to cover use-cases of different occurrences
 * of same component at different levels.
 * @param {*} treeLoadInput
 */
function processTreeLoadInputForNextPageLoad( treeLoadInput ) {
    var cursorIDParentMap = appCtxSvc.ctx.cursorIDParent;

    if ( treeLoadInput.cursorNodeId !== null && cursorIDParentMap.has( treeLoadInput.cursorNodeId ) ) {
        var parentContext;
        var parentNodes = cursorIDParentMap.get( treeLoadInput.cursorNodeId );

        // this is for use case when different occurrence of same component
        // is present at two different levels of tree
        for ( var inx = 0; inx < parentNodes.length; inx++ ) {
            if ( parentNodes[inx].uid === treeLoadInput.parentNode.uid ) {
                if ( parentNodes[inx].levelNdx === treeLoadInput.parentNode.levelNdx ) {
                    parentContext = parentNodes[inx];
                    // parent node value needs to be cleared from map to avoid any reload
                    if ( parentNodes.length !== 1 ) {
                        var index = parentNodes.indexOf( parentContext );
                        parentNodes.splice( index, 1 );
                        cursorIDParentMap.set( treeLoadInput.cursorNodeId, parentNodes );
                    }
                    //key deleted for single parent node
                    else {
                        cursorIDParentMap.delete( treeLoadInput.cursorNodeId );
                    }
                    break;
                }
            }
            parentContext = parentNodes[inx];
            if ( parentNodes.length === 1 ) {
                cursorIDParentMap.delete( treeLoadInput.cursorNodeId );
            }
        }
        if ( parentContext === undefined ) {
            parentContext = treeLoadInput.parentNode;
        }
        // for all use-cases:start index needs to updated in context to current parentNode
        // for children to be loaded correctly
        var startChildLoadIndx = parentContext.children.length;
        treeLoadInput.startChildNdx = startChildLoadIndx;
        // this is to identify different occurrences of same component
        var startChildID = parentContext.children[startChildLoadIndx - 1].id;
        treeLoadInput = awTableTreeSvc.createTreeLoadInput( parentContext, treeLoadInput.startChildNdx, treeLoadInput.cursorNodeId, startChildID,
            treeLoadInput.pageSize, true );
    }
    return treeLoadInput;
}


/**
 * Returns list of ViewModel Objects of Related Objects
 * @param {relatedSearchResponse} relatedSearchResponse - response from provider
 *
 * @return {relatedObjectsTableResultRows} list of ViewModel Objects
 */
export let processRelObjectsJSONResponse = function( relatedSearchResponse, cm1ImpactWidgetState = {} ) {
    var relatedObjectsTableResultRows = [];
    var relatedSearchResults = parsingUtils.parseJsonString( relatedSearchResponse.searchResultsJSON );
    var viewModeolObjectsFromJson = [];
    _.forEach( relatedSearchResults.objects, function( object ) {
        viewModeolObjectsFromJson.push( object );
    } );

    relatedObjectsTableResultRows = createViewModelTableNode( viewModeolObjectsFromJson );

    // related table vmo collected in parentstate
    const newCm1ImpactWidgetState = { ...cm1ImpactWidgetState.value };
    var dataProvidersLoadedVMOs = newCm1ImpactWidgetState.dataProvidersLoadedVMOs;
    dataProvidersLoadedVMOs.loadedRelatedVMOs = relatedObjectsTableResultRows;
    newCm1ImpactWidgetState.totalFoundRelated = relatedObjectsTableResultRows.length;
    newCm1ImpactWidgetState.dataProvidersLoadedVMOs = dataProvidersLoadedVMOs;
    cm1ImpactWidgetState.update && cm1ImpactWidgetState.update( newCm1ImpactWidgetState );

    return relatedObjectsTableResultRows;
};

/**
 * Returns list of ViewModel Objects of Related Objects
 * @param {persistedSearchResponse} persistedSearchResponse - response from provider
 *
 * @return {persistedObjectsTableResultRows} list of ViewModel Objects
 */
export let processPersistedObjectsJSONResponse = function( persistedSearchResponse, cm1ImpactWidgetState = {} ) {
    var persistedObjectsTableResultRows = [];
    var persistedSearchResults = parsingUtils.parseJsonString( persistedSearchResponse.searchResultsJSON );
    _.forEach( persistedSearchResults.objects, function( object ) {
        if ( !object.alternateID ) {
            persistedObjectsTableResultRows.push( object );
        }
    } );

    // persisted table vmo collected in parentstate
    const newCm1ImpactWidgetState = { ...cm1ImpactWidgetState.value };
    var dataProvidersLoadedVMOs = newCm1ImpactWidgetState.dataProvidersLoadedVMOs;
    dataProvidersLoadedVMOs.loadedPersistedVMOs = persistedObjectsTableResultRows;
    newCm1ImpactWidgetState.totalFoundImpacted = persistedObjectsTableResultRows.length;
    newCm1ImpactWidgetState.dataProvidersLoadedVMOs = dataProvidersLoadedVMOs;
    cm1ImpactWidgetState.update && cm1ImpactWidgetState.update( newCm1ImpactWidgetState );

    return { objects: persistedObjectsTableResultRows };
};

/**
 * if the related object search call is because of probable impacted table selection change
 * uid is read from selection
 *
 * if the related object search call is because of column arrange or filter , there can be no selection in
 * probable impacted table and uid is read from saved probable impacted table selection
 */
export let getProbableImpactedUid = function( props ) {
    if ( props !== undefined && props.cm1ImpactWidgetState !== undefined
        && props.cm1ImpactWidgetState.probImpactedLastSingleSelection !== '' ) {
        return props.cm1ImpactWidgetState.probImpactedLastSingleSelection.props.cm0ProposedImpactedObject.dbValue;
    }
    return;
};

/**
 * Checks if the selection is a change to populate tables in Impact Analysis Tab OR
 * it is selection of an object(for eg. component selection in ACE) to populate
 * reverse tree for ProbableImpacted table componetized at some other sublocation.
 * @param {object} currentSelection
 */
function isCurrentSelectionChange( currentSelection ) {
    var isChangeType = false;
    var parentVMO =  appCtxSvc.ctx.currentChange;
    var selectedVMO = currentSelection;

    var isSelectedChangeType = false;
    var isParentSelectedChangeType = false;
    if ( selectedVMO !== undefined && selectedVMO.modelType && selectedVMO.modelType.typeHierarchyArray.indexOf( 'ChangeItemRevision' ) !== -1 ) {
        isSelectedChangeType = true;
    }

    if ( parentVMO !== undefined && parentVMO !== null && parentVMO.modelType && parentVMO.modelType.typeHierarchyArray.indexOf( 'ChangeItemRevision' ) !== -1 ) {
        isParentSelectedChangeType = true;
    }

    if( isSelectedChangeType || isParentSelectedChangeType ) {
        isChangeType = true;
    }
    return isChangeType;
}

/**
 * calls SOA
 * @param {Object} treeLoadInput Tree Load Input
 * @param {Object} selectedItemObj Selected Item Revision
 * @param {Object} soaInput inputData Input for SOA
 * @param {object} data view model data
 * @param {object} uwDataProvider data provider
 * @param {object} policyJson property policy
 * @param {Object} deferred deferred input
 */
function buildTreeTableStructure( treeLoadInput, soaInput, data, uwDataProvider, policyJson, props ) {
    // set policy
    var policyId = propertyPolicySvc.register( policyJson );

    //call SOA
    return tcDataMgmtService.basePerformSearchViewModel( soaInput ).then(
        function( response ) {
            //unset policy
            if( policyId ) {
                propertyPolicySvc.unregister( policyId );
            }

            // if retrieving first level than set columns for table
            var retrievingFirstLevel = treeLoadInput.parentNode.levelNdx === -1;
            if ( retrievingFirstLevel ) {
                initColumsForProbableImpactedTable( response.columnConfig, uwDataProvider );
            }
            var endReachedVar = response.totalLoaded >= response.totalFound;
            var startReachedVar = treeLoadInput.startChildNdx <= 0;

            //reading the lastObjectUID and firtstObjectUID, to send this information to next SOA call.
            let lastObjectUidVar = '';
            let firstObjectUidVar = '';
            if( response.additionalSearchInfoMap !== undefined ) {
                lastObjectUidVar = response.additionalSearchInfoMap.additionalInfoMessages[1];
                firstObjectUidVar = response.additionalSearchInfoMap.additionalInfoMessages[0];
            }
            var tempCursorObject = {
                endReached: endReachedVar,
                startReached: startReachedVar,
                lastObjectUID:lastObjectUidVar,
                firstObjectUID: firstObjectUidVar
            };
            let cursorObjectUpdated = '';
            if( endReachedVar === false ) {
                cursorObjectUpdated = {
                    endReached: endReachedVar,
                    startReached: startReachedVar,
                    lastObjectUID: lastObjectUidVar,
                    firstObjectUID: firstObjectUidVar
                };
            }
            var parentNodeOfPaginatedChild = soaInput.searchInput.searchCriteria.parentUid;

            //parse ViewModel JSON to ViewModel objects
            var searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );

            // prepare view model object from search results and client cache
            var viewModeolObjectsFromJson = [];
            _.forEach( searchResults.objects, function( object ) {
                viewModeolObjectsFromJson.push( object );
            } );

            // prepare view model tree nodes for table
            var treeLoadResult = createViewModelTreeNode( treeLoadInput, viewModeolObjectsFromJson, data, parentNodeOfPaginatedChild, startReachedVar, endReachedVar, props );
            treeLoadResult.parentNode.cursorObject = tempCursorObject;
            if ( endReachedVar === false ) {
                treeLoadResult.parentNode.cursorObject = cursorObjectUpdated;
                collectParentNodesOfCursorID( treeLoadResult );
            }
            return {
                treeLoadResult: treeLoadResult,
                columnConfig:uwDataProvider.columnConfig
            };
        } );
}

/**
 * Till this point, previous page has been loaded.Before loading the next page
 * the cursor Id is calculated and added as key in map and the corresponding
 * parent node is collected.Later, when the index moves for next page , with cursor id available,
 * will check this map to get the correct parent, where the next page children should be added.
 * @param {*} treeLoadResult
 */
function collectParentNodesOfCursorID( treeLoadResult ) {
    if ( treeLoadResult.childNodes === undefined || treeLoadResult.childNodes === null ) {
        return;
    }
    var cursorIDParentMap = appCtxSvc.ctx.cursorIDParent;
    var lastLoadedChildIdx = treeLoadResult.childNodes.length - 1;
    var lastUid = treeLoadResult.childNodes[lastLoadedChildIdx].uid;
    var currentParentNode = treeLoadResult.parentNode;
    if( cursorIDParentMap ) {
        if ( cursorIDParentMap.has( lastUid ) ) {
            var allParentNodes = cursorIDParentMap.get( lastUid );
            _.forEach( allParentNodes, function( existingNode ) {
                //for different occurrence of same component
                if ( existingNode.uid === currentParentNode.uid ) {
                    if ( existingNode.cursorObject.endReached === true ) {
                        var index = allParentNodes.indexOf( existingNode );
                        allParentNodes.splice( index, 1 );
                        allParentNodes.push( currentParentNode );
                    } else {
                        allParentNodes.push( currentParentNode );
                    }
                }
                //for different component
                else {
                    allParentNodes.push( currentParentNode );
                }
            } );
            cursorIDParentMap.set( lastUid, allParentNodes );
        } else {
            cursorIDParentMap.set( lastUid, [ currentParentNode ] );
        }
    }
    appCtxSvc.updatePartialCtx( 'cursorIDParent', cursorIDParentMap );
}

/**
 * This function will convert the proposedImpacted Objects to View Model Objects
 * and returns the list
 * @param {searchResults} viewModeolObjectsFromJson input view model objects
 *
 * @return {vmNodes} response - list of View Model Objects
 */
function createViewModelTableNode( viewModeolObjectsFromJson ) {
    var vmNodes = [];
    for ( var childNdx = 0; childNdx < viewModeolObjectsFromJson.length; childNdx++ ) {
        var proxyObject = viewModeolObjectsFromJson[childNdx]; // view mode object parsed from JSON
        var endObjectVmo = viewModelObjectSvc.createViewModelObject( proxyObject.uid, 'EDIT', proxyObject.uid, proxyObject ); // This will merge JSON proxy object and object from service data

        //we will use icon of underlying object
        var underlyingObjectUid = endObjectVmo.props.cm0ProposedImpactedObject.dbValues[0];
        var underlyingObject = clientDataModelSvc.getObject( underlyingObjectUid );
        var iconType = underlyingObject.type;
        if ( endObjectVmo.props.cm0IsAlreadyImpacted.dbValue === true ) {
            endObjectVmo.cm0IsAlreadyImpacted = true;
        }
        if ( underlyingObject.props.object_string ) {
            endObjectVmo.props.object_string = underlyingObject.props.object_string;
            endObjectVmo.props.object_string = underlyingObject.props.object_string;
        }
        endObjectVmo.typeIconURL = iconSvc.getTypeIconURL( iconType );
        vmNodes.push( endObjectVmo );
    }
    colorDecoratorSvc.setDecoratorStyles( vmNodes );

    return vmNodes;
}

/**
 * @param {TreeLoadInput} treeLoadInput - Parameters for the operation.
 * @param {searchResults} viewModeolObjectsFromJson input view model objects
 * @param {object} data view model data
 *
 * @return {object} response
 */
function createViewModelTreeNode( treeLoadInput, viewModeolObjectsFromJson, data, parentNodeOfPaginatedChild, startReachedVar, endReachedVar, props ) {
    var vmNodes = [];
    // This is the "root" node of the tree or the node that was selected for expansion
    var parentNode = treeLoadInput.parentNode;
    var levelNdx = parentNode.levelNdx + 1;
    treeLoadInput.pageSize = viewModeolObjectsFromJson.length;
    for( var childNdx = 0; childNdx < viewModeolObjectsFromJson.length; childNdx++ ) {
        var proxyObject = viewModeolObjectsFromJson[ childNdx ]; // view mode object parsed from JSON
        var endObjectVmo = viewModelObjectSvc.createViewModelObject( proxyObject.uid, 'EDIT', proxyObject.uid, proxyObject ); // This will merge JSON proxy object and object from service data

        var displayName = endObjectVmo.props.cm0ProposedImpactedObject.uiValues[ 0 ];
        var objType = endObjectVmo.type;
        var objUid = endObjectVmo.uid;

        //we will use icon of underlying object
        var underlyingObjectUid = endObjectVmo.props.cm0ProposedImpactedObject.dbValues[ 0 ];
        var underlyingObject = clientDataModelSvc.getObject( underlyingObjectUid );
        var iconType = underlyingObject.type;
        var iconURL = iconSvc.getTypeIconURL( iconType );

        //Has children property
        var hasChildren = endObjectVmo.props.cm0HasChildren.dbValues[0];

        //Create treeModelObject
        var treeVmNode = awTableTreeSvc
            .createViewModelTreeNode( underlyingObject.uid, underlyingObject.type, displayName, levelNdx, childNdx, iconURL );

        //Generating unique id for each row. We can't reply on uid as we can have same object multiple time in same table.
        var id = treeVmNode.id + treeLoadInput.parentNode.id + childNdx + treeLoadInput.parentNode.levelNdx;
        treeVmNode.id = id;
        treeVmNode.alternateID = id;

        treeVmNode.cm0IsAlreadyImpacted = false;
        if( endObjectVmo.props.cm0IsAlreadyImpacted.dbValue === true && data.dataProviders.persistedImpactedDataProvider !== undefined ) {
            endObjectVmo.cm0IsAlreadyImpacted = true;
        }

        //copy properties from view model object to tree model object
        tcVmoService.mergeObjects( treeVmNode, endObjectVmo );
        tcVmoService.mergeObjects( treeVmNode, underlyingObject );


        //set object_string from underlying object to runtime object
        if( underlyingObject.props.object_string ) {
            treeVmNode.props.object_string.uiValues = underlyingObject.props.object_string.uiValues;
            treeVmNode.props.object_string.uiValue = underlyingObject.props.object_string.uiValues;
        }

        //set uid and type of underlying object otherwise we will have to implement lots of handlers to support adapter object hanndeling.
        //treeVmNode.uid = underlyingObjectUid;
        //treeVmNode.type = endObjectVmo.type;

        //set isLeaf on TreeModelObject
        treeVmNode.isLeaf = hasChildren === '0';

        if( treeVmNode ) {
            vmNodes.push( treeVmNode );
        }
    }
    colorDecoratorSvc.setDecoratorStyles( vmNodes );
    return awTableTreeSvc.buildTreeLoadResult( treeLoadInput, vmNodes, true, startReachedVar,
        endReachedVar, null );
}


/**
 * Build column information for Probable Impacted table.
 *
 * @param {ColumConfi} columnConfig - Column config returned by SOA
 * @param {UwDataProvider} dataProvider - The data provider for Probable Impacted table
 *
 */
function initColumsForProbableImpactedTable( columnConfig, dataProvider ) {
    // Build AW Columns
    var awColumnInfos = [];
    var columnConfigCols = columnConfig.columns;
    for ( var index = 0; index < columnConfigCols.length; index++ ) {
        // fix to increase column width for first column of probableImpacted Table
        var pixelWidth = columnConfigCols[index].pixelWidth;
        var enableColHiding = true;
        var sortDirection = '';
        var enableColumnMoving = true;
        if ( index === 0 ) {
            enableColHiding = false;
            sortDirection = 'Descending';
            enableColumnMoving = false;
        }
        var columnInfo = {
            field: columnConfigCols[index].propertyName,
            name: columnConfigCols[index].propertyName,
            propertyName: columnConfigCols[index].propertyName,
            displayName: columnConfigCols[index].displayName,
            typeName: columnConfigCols[index].associatedTypeName,
            pixelWidth: pixelWidth,
            hiddenFlag: columnConfigCols[index].hiddenFlag,
            enableColumnResizing: true,
            sortDirection:sortDirection,
            enableColumnMoving:enableColumnMoving,
            enableColumnHiding: enableColHiding,
            enablePinning: false
        };
        var awColumnInfo = awColumnSvc.createColumnInfo( columnInfo );

        awColumnInfos.push( awColumnInfo );
    }

    // Set columnConfig to Data Provider.
    dataProvider.columnConfig = {
        columnConfigId: columnConfig.columnConfigId,
        columns: awColumnInfos
    };
}

/**
 * This function will return the Soa Input for createRelations
 * @param {data} data - View Model for Impact Analysis
 *
 * @return {object} createInput to create impacted relation name
 */
export let getCreateInputToCreteImpactedRelation = function( data ) {
    var inputData = {};
    var soaInput = [];

    // primary
    var changeObjectUid = data.selectedChangeObjectUid;
    var changeVMO = clientDataModelSvc.getObject( changeObjectUid );

    //secondary : get selected objects from probable impacted table
    var probableImpacted = [];
    var probableImpactedDataProvider = data.dataProviders.probableImpactedDataProvider;
    var selectedProxyObjects = probableImpactedDataProvider.selectedObjects;

    _.forEach( selectedProxyObjects, function( proxyObject ) {
        var underlyingObjectUid = proxyObject.props.cm0ProposedImpactedObject.dbValues[ 0 ];
        var underlyingObject = clientDataModelSvc.getObject( underlyingObjectUid );
        probableImpacted.push( underlyingObject );
    } );

    //create input
    _.forEach( probableImpacted, function( proxyObject ) {
        inputData = {
            clientId: '',
            primaryObject: changeVMO,
            relationType: 'CMHasImpactedItem',
            secondaryObject: proxyObject,
            userData: { uid: 'AAAAAAAAAAAAAA', type: 'unknownType' }
        };
        soaInput.push( inputData );
    } );
    return soaInput;
};


/**
 * @param {Object} primaryObject - drop target object
 * @param {Array} secondaryObjects - dragged sources objects
 * @returns {Promise} Resolved when all processing is complete.
 */
export let defaultPasteHandlerForImpactAnalysis = function( primaryObject, secondaryObjects ) {
    var deferred = AwPromiseService.instance.defer();
    var relationType = 'CMHasImpactedItem';
    var input = [];
    var localTextBundle = localeSvc.getLoadedText( 'ChangeMessages' );
    var singleObjectPasted = localTextBundle.pasteImpactedSuccessMessage;
    var multipleObjectsPasted = localTextBundle.pasteMultipleImpactedSuccessMessage;
    singleObjectPasted = singleObjectPasted.replace( '{1}', primaryObject.changeVmo.props.object_string.dbValues[0] );
    multipleObjectsPasted = multipleObjectsPasted.replace( '{1}', primaryObject.changeVmo.props.object_string.dbValues[0] );
    var displayStr = '';
    for( var i = 0; i < secondaryObjects.length; i++ ) {
        var secondaryObject = secondaryObjects[ i ];
        var jsoObj = {
            clientId: '',
            primaryObject: {
                uid: primaryObject.changeVmo.uid,
                type: primaryObject.changeVmo.type
            },
            relationType: relationType,
            secondaryObject: {
                uid: secondaryObject.uid,
                type: secondaryObject.type
            }
        };
        input.push( jsoObj );
        if( secondaryObjects.length === 1 ) {
            displayStr += secondaryObjects[0].props.object_string.uiValues[0];
        }else if( i !== secondaryObjects.length - 1 ) {
            displayStr += secondaryObjects[i].props.object_string.uiValues[0] + ',';
        }else {
            displayStr += secondaryObjects[i].props.object_string.uiValues[0];
        }
    }

    var relInput = {
        input: input
    };

    soaSvc.post( 'Core-2006-03-DataManagement', 'createRelations', relInput ).then( function( response ) {
        eventBus.publish( 'resetPersistedImpactedTable.refreshTable' );
        if( secondaryObjects.length === 1 ) {
            singleObjectPasted = singleObjectPasted.replace( '{0}', displayStr );
            messageSvc.showInfo( singleObjectPasted );
        }else {
            multipleObjectsPasted = multipleObjectsPasted.replace( '{0}', displayStr );
            messageSvc.showInfo( multipleObjectsPasted );
        }
        deferred.resolve( response );
    },
    function( err ) {
        if( err.cause !== undefined && err.cause.updated !== undefined && err.cause.updated.length > 0 ) {
            eventBus.publish( 'resetPersistedImpactedTable.refreshTable' );
        }
        deferred.reject( err );
    } );


    return deferred.promise;
};

/**
 * this function is used to calculate color indicator for probable impacted candidates
 * @param {Object} cm1ImpactWidgetState : cm1ImpactWidgetState state
 * @param {Object} changeObject :change object
 * @returns
 */
export let calculateColorIndicatorForProbableImpacted = function( cm1ImpactWidgetState = {}, changeObject ) {
    // Need to show color indicators for common items between probable impacted and persisted impacted
    const newCm1ImpactWidgetState = { ...cm1ImpactWidgetState.value };
    var dataProvidersLoadedVMOs = newCm1ImpactWidgetState.dataProvidersLoadedVMOs;
    if ( dataProvidersLoadedVMOs === undefined ) {
        return;
    }
    var persistedImpactedVmos = dataProvidersLoadedVMOs.loadedPersistedVMOs;
    var probableImpactedVmos = dataProvidersLoadedVMOs.loadedProbableImpactedVMOs;
    let nonImpactedUids = [];
    if ( changeObject !== undefined && changeObject.props.Cm0HasNonImpactedItem !== undefined
        && changeObject.props.Cm0HasNonImpactedItem.dbValue.length > 0 ) {
        nonImpactedUids = changeObject.props.Cm0HasNonImpactedItem.dbValue.map( uid => uid );
    }

    var persistedImpactedUid = [];

    _.forEach( persistedImpactedVmos, function( vmo ) {
        persistedImpactedUid.push( vmo.uid );
    } );

    var modifiedVmo = [];
    _.forEach( probableImpactedVmos, function( vmo ) {
        vmo.colorTitle = '';
        vmo.cellDecoratorStyle = '';
        vmo.gridClassName = '';
        vmo.gridDecoratorStyle = '';

        // Set 'cm0IsNotImpacted' to true if the VMO UID is in the non-impacted list
        vmo.cm0IsNotImpacted = nonImpactedUids.includes( vmo.uid );
        // Check if the VMO UID is in the persisted impacted list
        const isUidImpacted = persistedImpactedUid.includes( vmo.uid );
        const usageRevisionValue = vmo.props?.cm0UsageRevision?.dbValue;

        // Check if the VMO UID is impacted or if its usageRevisionValue is in the impacted list
        vmo.cm0IsAlreadyImpacted = isUidImpacted || usageRevisionValue && persistedImpactedUid.includes( usageRevisionValue );
        modifiedVmo.push( vmo );
    } );
    colorDecoratorSvc.setDecoratorStyles( modifiedVmo );
    eventBus.publish( 'decoratorsUpdated', modifiedVmo );
};


/**
 * This will update indicator in Related Objects table
 * based on its addition/removal in Impacted Item table
 *
 *  @param {object} data view model data
 */
export let calculateColorIndicatorForRelObjectImpacted = function( cm1ImpactWidgetState = {}, changeObject ) {
    // Need to show color indicators for common items between probable impacted and persisted impacted
    const newCm1ImpactWidgetState = { ...cm1ImpactWidgetState.value };
    var dataProvidersLoadedVMOs = newCm1ImpactWidgetState.dataProvidersLoadedVMOs;
    if ( dataProvidersLoadedVMOs === undefined ) {
        return;
    }
    var persistedImpactedVmos = dataProvidersLoadedVMOs.loadedPersistedVMOs;
    var relationImpactedVmos = dataProvidersLoadedVMOs.loadedRelatedVMOs;

    let nonImpactedUids = [];
    if ( changeObject !== undefined && changeObject.props.Cm0HasNonImpactedItem !== undefined
        && changeObject.props.Cm0HasNonImpactedItem.dbValue.length > 0 ) {
        nonImpactedUids = changeObject.props.Cm0HasNonImpactedItem.dbValue.map( uid => uid );
    }

    var persistedImpactedUid = [];

    _.forEach( persistedImpactedVmos, function( vmo ) {
        persistedImpactedUid.push( vmo.uid );
    } );


    var modifiedVmo = [];
    _.forEach( relationImpactedVmos, function( vmo ) {
        vmo.colorTitle = '';
        vmo.cellDecoratorStyle = '';
        vmo.gridClassName = '';
        vmo.gridDecoratorStyle = '';
        let underlyingObjectUid = vmo.props.cm0ProposedImpactedObject.dbValues[0];
        let underlyingObject = clientDataModelSvc.getObject( underlyingObjectUid );
        let iconType = underlyingObject.type;
        if ( nonImpactedUids.includes( underlyingObjectUid ) ) {
            vmo.cm0IsNotImpacted = true;
        } else {
            vmo.cm0IsNotImpacted = false;
        }

        if ( persistedImpactedUid.includes( underlyingObjectUid ) ) {
            vmo.cm0IsAlreadyImpacted = true;
        }else {
            vmo.cm0IsAlreadyImpacted = false;
        }
        vmo.typeIconURL = iconSvc.getTypeIconURL( iconType );
        modifiedVmo.push( vmo );
    } );

    colorDecoratorSvc.setDecoratorStyles( modifiedVmo );
    eventBus.publish( 'decoratorsUpdated', modifiedVmo );
};

export let processPersistedImpactedTableSelection = function( data, props ) {
    // set relation context for cut functionality to work.
    let selection = data.dataProviders.persistedImpactedDataProvider.selectedObjects;
    let changeVMO = { ...props.changeObject };
    let relationContext = {
        relationInfo:[]
    };
    // appCtxSvc.ctx.relationContext = {};
    // appCtxSvc.ctx.relationContext.relationInfo = [];
    if ( selection && selection.length > 0 ) {
        for ( var idx = 0; idx < selection.length; idx++ ) {
            var relInfo = {};
            relInfo.primaryObject = changeVMO;
            relInfo.secondaryObject = selection[idx];
            relInfo.relationType = 'CMHasImpactedItem';
            //appCtxSvc.ctx.relationContext.relationInfo.push( relInfo );
            relationContext.relationInfo.push( relInfo );
        }
    }
    appCtxSvc.registerCtx( 'relationContext', relationContext );
    //required for cut operation message , that uses mselected,pselected
    // due to relation browser resetting the pselected/mselected in Relation View ,it is lost.
    appCtxSvc.updatePartialCtx( 'pselected', changeVMO );
    appCtxSvc.updatePartialCtx( 'mselected', selection );
};
/**
 * Deselect Relation Browser Graph selection
 * This is required while selecting in persisted impacted table in Relation View.
 * Also required to deselect graph after adding or removing impacted items in Relation view
 *
 * @param {*} graphModel
 */
export let deSelectRelationBrowserGraph = function( graphModel ) {
    if ( graphModel !== undefined && graphModel !== null && graphModel.numSelected !== undefined && graphModel.numSelected > 0 ) {
        graphModel.graphControl.setSelected( null, false, appCtxSvc.ctx.selectedChangeVmo );
    }
};

/**
 * This will restore the probableImpacted Table selection,
 * when all the objects in related Object table is deselected.
 *
 *  @param {object} data view model data
 */
export let setProbableImpactedTableSelection = function( data, props ) {
    if( props.cm1ImpactWidgetState.probImpactedLastSingleSelection !== '' ) {
        data.dataProviders.probableImpactedDataProvider.selectionModel.setSelection( props.cm1ImpactWidgetState.probImpactedLastSingleSelection );
    }
};
/**
 * This function will expand the loaded first node in probable impacted table,
 * if it is not already expanded. Also it will select the first node and display Related Object table
 * if there are related objects to it.
 *
 * @param {object} data
 * @param {object} loadedTreeNodes loaded tree nodes of probable impacted table
 */
export let expandAndSelectFirstLevelTreeNode = function( data, loadedTreeNodes, cm1ImpactWidgetState ) {
    _.defer( function() {
        // The  deferred calls are made
        // to allow the tree to draw before we asked it to expand a node.
        if ( loadedTreeNodes.length > 0 ) {
            var expandNode = loadedTreeNodes[0];

            // Checks if node is not null and not expanded then only set
            // isExpanded to true and fire the event
            if ( expandNode && !expandNode.isExpanded ) {
                expandNode.isExpanded = true;
                eventBus.publish( 'probableImpactedGrid.plTable.toggleTreeNode', expandNode );
            }
            var lastNode = loadedTreeNodes[loadedTreeNodes.length - 1];

            if ( expandNode && expandNode.selected === false && lastNode._expandRequested !== true ) {
                if ( data !== undefined ) {
                    data.dataProviders.probableImpactedDataProvider.selectionModel.setSelection( expandNode );
                }
                if( isImpactAnalysisLocation() ) {
                    const newCm1ImpactWidgetState = { ...cm1ImpactWidgetState.value };
                    if( newCm1ImpactWidgetState.probImpactedLastSingleSelection === '' ) {
                        newCm1ImpactWidgetState.probImpactedLastSingleSelection = expandNode;
                    }
                    //Caching the VMO list of propbable impacted table in parent state
                    cm1ImpactWidgetState.update && cm1ImpactWidgetState.update( newCm1ImpactWidgetState );
                }
            }
        }
    } );
};
/**
 * This function sets targetvmo to ChangeImpactedItem for drag and drop
 * on persisted impacted table element. It will also set the allowed source types for drop
 * on this table and will set dropuid to selected change for source to be pasted on.
 * @param {object} data
*/
export let setDropTargetOnPersistedImpactedTable = function( data, props ) {
    return appCtxSvc.ctx.vmo;
};


/**
 * "dropHandlers" are used to enable and customize the drop operation for a view and
 * the components inside it. If a dropHandler is activated for a certain view, then
 * the same dropHandler becomes applicable to all the components inside the view.
 * This means, we can handle any drop/dragEnter/dragOver operation for any component
 * inside a view at the view level. Not all the components used inside a view have
 * drop configured, when a dropHandler is active for a view.
 * The action associated bind-ed with drag actions is expected to be a synchronous
 * javascript action. we can only associate declarative action type syncFunction with
 * drag actions. At runtime the js function (bind-ed with drag action) receives a system
 * generated object as the last parameter of the function.
 *
 * For more info  :- http://swf/showcase/#/showcase/Declarative%20Configuration%20Points/dragAndDrop
 *
 * @param {default parameters for DnD} dragAndDropParams
 */
export let tableViewDragOver = ( dragAndDropParams ) => {
    if( dragAndDropParams.dataProvider ) {
        return {
            dropEffect: 'copy',
            stopPropagation: true,
            preventDefault : true
        };
    }
    return {
        dropEffect: 'none',
        stopPropagation: true
    };
};

/**
 * Function (dropHandler) to create a relation between the impacted item dragged over on persisted
 * impacted table, and the change object, when that item is dropped over the table.
 *
 * @param {default parameters for DnD} dragAndDropParams
 */
export let tableViewDropOver = ( dragAndDropParams ) => {
    // Below fix is needed as their is one specific issue with firefox where drop object is
    // being opened. Fix for defect # LCS-687300
    dragAndDropParams.event.stopPropagation();
    dragAndDropParams.event.preventDefault();

    const dragDataJSON = localStrg.get( 'draggedListData' );
    if ( dragDataJSON ) {
        const draggedObj = JSON.parse( dragDataJSON );
        eventBus.publish( 'cm1ImpactAnalysis.changePasteService', draggedObj );
        clearCachedData();
    }
};

/**
 * Initializes Persisted Impacted Table and adds dataprovider to main
 * data of Impact Analysis ViewModel
 * @param {*} inContextData
 */
export let populateData = function( problemItemListProp, data ) {
    // Set default view if not set already
    if( !appCtxSvc.ctx.ImpactsViewMode ) {
        var newView = 'TableView';
        appCtxSvc.registerCtx( 'ImpactsViewMode', newView );
        //collects separate viewmodel dataprovider in main viewmodel data for interaction purpose
        //between different tables
        //appCtxSvc.registerCtx( 'ImpactsViewData', data );
    }


    //enable decorators
    appCtxSvc.updatePartialCtx( 'decoratorToggle', true );

    //get Problem Items for selected change object
    var changeObjectUid = exports.getChangeObjectUid();

    var selectedChangeVMO = clientDataModelSvc.getObject( changeObjectUid );

    //setting temprorary vmo on data to support drag-drop.
    var impactedChangeVMOs = [];
    var impactedChangeVMO = {
        uid: selectedChangeVMO.uid + 'ChangeImpactedItem',
        type: 'ChangeImpactedItem'
    };
    impactedChangeVMOs.push( impactedChangeVMO );
    clientDataModelSvc.cacheObjects( impactedChangeVMOs );

    impactedChangeVMO = clientDataModelSvc.getObject( selectedChangeVMO.uid + 'ChangeImpactedItem' );
    impactedChangeVMO.modelType = {
        typeHierarchyArray: [ 'ChangeImpactedItem' ]
    };
    impactedChangeVMO.changeVmo = selectedChangeVMO;
    appCtxSvc.ctx.vmo = impactedChangeVMO;

    let problemItemListProperty = { ... problemItemListProp };

    // Select the default problem item
    problemItemListProperty.dbValue = data.problemItems[ 0 ].propInternalValue;
    problemItemListProperty.uiValue = data.problemItems[ 0 ].propDisplayValue;

    return {
        selectedProblemItem: problemItemListProperty,
        isDropTargetSet:false,
        changeImpactedVMO:impactedChangeVMO,
        selectedChangeVMO:selectedChangeVMO,
        selectedChangeObjectUid:changeObjectUid,
        problemItemLOVLoaded:true
    };
};
/**
 * This function will update the state  if any of the table object gets selected and remove the other selections
 * @param {data} data - View Model for Impact Analysis
 *
 * @return {object} createInput to create impacted relation name
 */
export const updateParentState = ( selectedObjects, dataProvider, cm1ImpactWidgetState = {} ) => {
    if( selectedObjects.length > 0 ) {
        const newCm1ImpactWidgetState = { ...cm1ImpactWidgetState.value };
        newCm1ImpactWidgetState.selectedObjects = selectedObjects;
        newCm1ImpactWidgetState.displayTitle = selectedObjects[0].displayName;

        //Saving the selection of probable impacted table to use it as by default selection if nothing is selected
        if( dataProvider.name === 'probableImpactedDataProvider' && selectedObjects.length === 1 && selectedObjects[0] !== newCm1ImpactWidgetState.probImpactedLastSingleSelection ) {
            newCm1ImpactWidgetState.probImpactedLastSingleSelection = selectedObjects[0];
        }
        newCm1ImpactWidgetState.dataProviderName = dataProvider.name;
        cm1ImpactWidgetState.update && cm1ImpactWidgetState.update( newCm1ImpactWidgetState );
    }else if( dataProvider.name === 'probableImpactedDataProvider' ) {
        const newCm1ImpactWidgetState = { ...cm1ImpactWidgetState.value };
        newCm1ImpactWidgetState.displayTitle = '';
        cm1ImpactWidgetState.update && cm1ImpactWidgetState.update( newCm1ImpactWidgetState );
    }
};

/**
 * This function will add the dataprovider information of the tables in parent state.
 * Dataprovider information is updated in parent state whenever table is reloaded.
 * Tables will be able to access dataprovider information of all the three tables ,
 * which is needed for calculating color indicator.
 * @param {*} dataProvider
 * @param {*} cm1ImpactWidgetState
 */
export const updateDataProvidersInParentState = ( response, dataProvider, cm1ImpactWidgetState ) => {
    if( isImpactAnalysisLocation() ) {
        const newCm1ImpactWidgetState = { ...cm1ImpactWidgetState.value };
        var dataProvidersLoadedVMOs = newCm1ImpactWidgetState.dataProvidersLoadedVMOs;
        // all the loaded tree nodes vmo collected at  different level in parent state
        if ( dataProvider.name === 'probableImpactedDataProvider' ) {
            var searchResults = response.treeLoadResult;

            var levelsLoaded = dataProvidersLoadedVMOs.loadedProbableImpactedVMOs;
            _.forEach( searchResults.childNodes, function( object ) {
                var vmoFound = _.find( levelsLoaded, function( levelObject ) {
                    return levelObject.id === object.id;
                } );
                if ( vmoFound !== undefined ) {
                    var index = levelsLoaded.indexOf( vmoFound );
                    levelsLoaded.splice( index, 1 );
                }
                levelsLoaded.push( object );
            } );
            dataProvidersLoadedVMOs.loadedProbableImpactedVMOs = levelsLoaded;
        }
        // impacted table vmo collected on modelUpdate in parentstate
        if ( dataProvider.name === 'persistedImpactedDataProvider' ) {
            dataProvidersLoadedVMOs.loadedPersistedVMOs = dataProvider.viewModelCollection.loadedVMObjects;
        }

        newCm1ImpactWidgetState.dataProvidersLoadedVMOs = dataProvidersLoadedVMOs;
        cm1ImpactWidgetState.update && cm1ImpactWidgetState.update( newCm1ImpactWidgetState );
    }
};

/**
 * Update DataProvider loaded Vmos in parent State on Model Update.
 * This will be used to calculate color indicator after modelUpdate
 * @param {*} dataProvider
 * @param {*} cm1ImpactWidgetState
 */
export const updateDPInParentStateOnModelUpdate = ( dataProvider, cm1ImpactWidgetState = {} ) => {
    const newCm1ImpactWidgetState = { ...cm1ImpactWidgetState.value };
    var dataProvidersLoadedVMOs = newCm1ImpactWidgetState.dataProvidersLoadedVMOs;

    // impacted table vmo collected on modelUpdate in parentstate
    if ( dataProvider.name === 'persistedImpactedDataProvider' ) {
        dataProvidersLoadedVMOs.loadedPersistedVMOs = dataProvider.viewModelCollection.loadedVMObjects;
    }

    newCm1ImpactWidgetState.dataProvidersLoadedVMOs = dataProvidersLoadedVMOs;
    cm1ImpactWidgetState.update && cm1ImpactWidgetState.update( newCm1ImpactWidgetState );
};

/**
 * On tab switch, Impact analysis first table data is cleared.
 * This is required to check that first table is loaded before impacted table is loaded,
 * when next time impact analysis tab is clicked.
 * Otherwise, impacted table initialization will throw exception.
 * @param {*} cm1ImpactWidgetState
 */
export const clearTableData = ( cm1ImpactWidgetState = {} ) => {
    if ( appCtxSvc.ctx.ImpactsViewMode !== undefined && appCtxSvc.ctx.ImpactsViewMode !== 'RelationView' ) {
        const newCm1ImpactWidgetState = { ...cm1ImpactWidgetState.value };
        newCm1ImpactWidgetState.dataProvidersLoadedVMOs.loadedProbableImpactedVMOs = [];
        cm1ImpactWidgetState.update && cm1ImpactWidgetState.update( newCm1ImpactWidgetState );
    }
};
export const updateSelections = ( selectionData, ...selectionModels ) => {
    //if something is selected
    if( selectionData.selected && selectionData.selected[ 0 ] ) {
        selectionModels.forEach( ( selModel ) => {
            //If the selection data is different from the current selection, update the model.
            if( selModel.selectionData !== undefined && selModel.selectionData.value !== undefined && selModel.selectionData.value !== selectionData )
            //Avoid updating with redundant info, if there is nothing selected
            {
                // If this is the 'impactCandidatesSelModel', deactivate it
                if ( selModel.name === 'impactCandidatesSelModel' && selectionData.id === 'relatedItemsSelModel' ) {
                    selModel.setSelectionModelActivated( false );
                } else if ( selectionData.id === 'impactItemsSelMoel' ) {
                    // Deactivate impactCandidatesSelModel if selectionData originates from impactItemsSelMoel
                    const impactCandidatesModel = selectionModels.find( ( model ) => model.name === 'impactCandidatesSelModel' );
                    if ( impactCandidatesModel ) {
                        impactCandidatesModel.setSelectionModelActivated( false );
                    }
                } else {
                    // For other models, clear their current selection
                    selModel.setSelection( null );
                }
            }
        } );
    } else if( selectionModels.every( ( model ) => { return !model.getSelection()[ 0 ]; } ) ) {
        // Check if all selModels are deselected
        // and we have a default impacted candidates selection, then
        eventBus.publish( 'setProbableImpactedTableSelection' );
    } else {
        // If some selmodels are still selected, make sure 'impactCandidatesSelModel' is activated.
        selectionModels.forEach( ( selModel ) => {
            if( selModel.name === 'impactCandidatesSelModel' ) {
                selModel.setSelectionModelActivated( true );
            }
        } );
    }
};

/**
 * This function returns true if its an impact analysis location, otherwise returns false.
 * This is required because parent traversal view model can be injected at other locations
 * and for other locations, impact wideget state is not needed to be updated.
 */
export let isImpactAnalysisLocation = () => {
    let isImpactAnalysisLoc = false;
    if( appCtxSvc.ctx.xrtSummaryContextObject && appCtxSvc.ctx.xrtSummaryContextObject.modelType && appCtxSvc.ctx.xrtSummaryContextObject.modelType.typeHierarchyArray.indexOf( 'ChangeItemRevision' ) > -1 ) {
        isImpactAnalysisLoc = true;
    }

    return isImpactAnalysisLoc;
};

/**
 * This function is called when we do a drag operation on the table.
 * Here, we are adding the target objects that we get while doing drag to draggedListData.
 * @param {Object} extraParams : extra params
 * @param {Object} dnDParams : default paarameters of drag and drop
 */
export let dragStartImpactAnalysisFn = ( extraParams, dnDParams ) => {
    localStrg.publish( 'draggedListData', JSON.stringify( dnDParams.targetObjects ) );
};

/**
 * Clear the cache data.
 */
const clearCachedData = () => {
    localStrg.removeItem( 'draggedListData' );
};

/**
 * This function is used to delete CMHasImpactedItem or Cm0HasNonImpactedItem relations
 * @param {Object} changeObject : Change Object
 * @param {Array} selectionData : Selections made in table
 * @param {Boolean} deleteImpactedRelations : True (delete CMHasImpactedItem ) | False (delete Cm0HasNonImpactedItem ).
 */
export let deleteRelations = async function( changeObject, selectionData, deleteImpactedRelations = true ) {
    if ( selectionData.selected.length > 0 ) {
        const soaInput = [];
        selectionData.selected.forEach( selectedObj => {
            let relationType = '';
            if ( deleteImpactedRelations && selectedObj.cm0IsAlreadyImpacted ) {
                relationType = 'CMHasImpactedItem';
            } else if ( !deleteImpactedRelations && selectedObj.cm0IsNotImpacted ) {
                relationType = 'Cm0HasNonImpactedItem';
            }
            if ( relationType !== '' ) {
                if( selectedObj.type === 'Cm0ProposedImpactedObject' ) {
                    selectedObj = clientDataModelSvc.getObject( selectedObj.props.cm0ProposedImpactedObject.dbValues[0] );
                }
                soaInput.push( cmUtils.createInputDataForDeleteOrCreateRelations( changeObject, relationType, selectedObj ) );
            }
        } );
        if ( soaInput.length > 0 ) {
            return soaSvc.post( 'Core-2006-03-DataManagement', 'deleteRelations', { input: soaInput } );
        }
    }
};

/**
 * This function is used to create input for createRelations soa call for creating Cm0HasNonImpactedItem relation
 * @param {Object} changeObject : Change object
 * @param {Array} selectionData : Selections made in table
 * @returns
 */
export let inputForCreateNotImpactedRelationsCall = ( changeObject, selectionData ) => {
    if ( selectionData.selected.length > 0 ) {
        let soaInput = [];
        selectionData.selected.forEach( function( selectedObj ) {
            const underlyingObject = clientDataModelSvc.getObject( selectedObj.props.cm0ProposedImpactedObject.dbValues[0] );
            soaInput.push( cmUtils.createInputDataForDeleteOrCreateRelations( changeObject, 'Cm0HasNonImpactedItem', underlyingObject ) );
        } );
        return soaInput;
    }
};

/**
 * This function is used to get effectivities from change object
 * @param {Object} response: response from getProperties soa call
 * @param {ViewModelProperty} effListBox: ViewModelProperty
 * @returns effectivities
 */
export let getReleaseStatusList = ( response, effListBox ) => {
    let changeObj = clientDataModelSvc.getObject( appCtxSvc.ctx.xrtSummaryContextObject.uid );
    let releaseStatusObj = null;
    let effectivities = [];
    if( changeObj.props.release_status_list ) {
        releaseStatusObj = cdm.getObject( changeObj.props.release_status_list.dbValues[ 0 ] );
    }
    if( releaseStatusObj ) {
        for( var x = 0; x < releaseStatusObj.props.effectivities.dbValues.length; x++ ) {
            if( !effListBox.dbValues.includes( releaseStatusObj.props.effectivities.dbValues[ x ] ) ) {
                let eff = {
                    propDisplayValue: releaseStatusObj.props.effectivities.uiValues[ x ],
                    propInternalValue: releaseStatusObj.props.effectivities.dbValues[ x ],
                    propDisplayDescription: '',
                    dbValue: releaseStatusObj.props.effectivities.dbValues[ x ],
                    dispValue: releaseStatusObj.props.effectivities.uiValues[ x ]
                };
                effectivities.push( eff );
            }
        }
    }
    return effectivities;
};

/**
 * This function is used to get relevant products for selected problem item
 * @param {Object} response : response from getWhereUsedInfo soa
 * @param {ViewModelProperty} productIDLOV: ViewModelProperty
 * @returns : relevant products for selected problem item
 */
export let relevantProducts = ( response, productIDLOV ) => {
    let modelObjects = [];
    if( response.childToParentMap ) {
        for( let indx = 0; indx < response.childToParentMap[ 0 ].length; indx++ ) {
            for( let jndx = 0; jndx < response.childToParentMap[ 1 ][ indx ].length; jndx++ ) {
                const obj = response.childToParentMap[ 1 ][ indx ][ jndx ];
                const modelObj = cdm.getObject( obj.resultObject.props.items_tag.dbValues[0] );
                if( !productIDLOV.dbValues.includes( modelObj.uid ) ) {
                    modelObjects.push(
                        {
                            propDisplayValue: obj.resultObject.props.object_string.uiValues[ 0 ],
                            propInternalValue: modelObj.uid,
                            propDisplayDescription: '',
                            hasChildren: false,
                            children: {},
                            sel: true
                        }
                    );
                }
            }
        }
    }
    return modelObjects;
};

/**
 * This functions updates configuartionState with selected problem item, rev rule, effcectivity, product IDs
 * @param {Object} configState : configuration state
 * @param {Object} data: view model data
 * @param {Object} selectedProblemItem : selected problem item
 */
export let updateConfigState = ( configState, data = null, selectedProblemItem = null ) => {
    let newConfigState = _.clone( configState );
    if( selectedProblemItem !== null ) {
        newConfigState.selectedProblemItem = selectedProblemItem;
        newConfigState.displayValues.revRule = appCtxSvc.ctx.userSession.props.awp0RevRule.uiValue;
    }

    if( data !== null ) {
        if( data.revRule && data.revRule.dbValue !== null ) {
            newConfigState.selectedRevRuleUID = data.revRule.dbValue;
            newConfigState.displayValues.revRule = data.revRule.uiValue;
        }

        if( data.effListBox && data.effListBox.dbValue.length >= 1 ) {
            newConfigState.selectedEffUIDs = data.effListBox.dbValue;
            newConfigState.displayValues.singleEffectivity =  data.effListBox.displayValues[0];
            newConfigState.displayValues.selectedEffectivities = data.effListBox.displayValues.slice( 1 );
        } else {
            newConfigState.selectedEffUIDs = data.effectivity && data.effectivity.dbValue ? [ data.effectivity.dbValue ] : [];
            newConfigState.displayValues.singleEffectivity = data.effectivity && data.effectivity.uiValue ? data.effectivity.uiValue : '';
            newConfigState.displayValues.selectedEffectivities = [];
        }

        if( data.productIDLOV && data.productIDLOV.dbValue.length >= 1 ) {
            newConfigState.prodContextIds = data.productIDLOV.dbValue;
            newConfigState.displayValues.singleProductId = data.productIDLOV.displayValues[0];
            newConfigState.displayValues.selectedProductIDs = data.productIDLOV.displayValues.slice( 1 );
        } else {
            newConfigState.prodContextIds = data.productIDSingle && data.productIDSingle.dbValue ? [ data.productIDSingle.dbValue ] : [];
            newConfigState.displayValues.singleProductId = data.productIDSingle && data.productIDSingle.uiValue ?  data.productIDSingle.uiValue : '';
            newConfigState.displayValues.selectedProductIDs = [];
        }
    }
    configState.update( newConfigState );
};

/**
 * This function updates the effectivity list box
 * @param {UwDataProvider} provider: data provider for effectivities
 * @param {Array} selected: array of selected effectivities
 */
export let updateEffectivityListBox = ( provider, selected ) => {
    let loadedEffVals = provider.viewModelCollection.loadedVMObjects;
    loadedEffVals = loadedEffVals.filter( ( effVal ) => {
        return selected.length > 0 ? !selected.includes( effVal.dbValue ) : selected !== effVal.dbValue;
    } );
    provider.update( loadedEffVals, loadedEffVals.length );
};

/**
 * This function updates the product ID listbox
 * @param {UwDataProvider} provider:data provider for products
 * @param {Array} selected:array of selected products
 */
export let updateProductIDListBox = ( provider, selected ) => {
    let loadedProdIDs = provider.viewModelCollection.loadedVMObjects;
    loadedProdIDs = loadedProdIDs.filter( ( prodID ) => {
        return selected.length > 0 ? !selected.includes( prodID.propInternalValue ) : selected !== prodID.propInternalValue;
    } );
    provider.update( loadedProdIDs, loadedProdIDs.length );
};

/**
 * Retrieves filtered revision rules based on the provided lovDataInfo and filterBox.
 * @param {Object} lovDataInfo - The lovDataInfo object containing the lovEntries.
 * @param {Object} filterBox - The filterBox object used for filtering.
 * @returns {Object} - The updated lovDataInfo object with filtered lovEntries.
 */
export let getFilteredRevisionRules = ( lovDataInfo, filterBox ) => {
    let filteredLovEntries = lovDataInfo.lovEntries.filter( lovEntry => cmUtils.filterSearch( filterBox.dbValue, lovEntry.propDisplayValue ) );
    lovDataInfo.lovEntries = filteredLovEntries;
    return lovDataInfo;
};

/**
 * Sets the revision rule filter based on the provided event data and selected revision rule.
 * @param {Object} eventData - The event data containing the selected value.
 * @param {Object} selectedRevRule - The selected revision rule.
 * @returns {Object} - The updated selected revision rule.
 */
export let setRevisionRuleFilter = ( eventData, selectedRevRule ) => {
    const newSelectedRevRule = _.clone( selectedRevRule );
    newSelectedRevRule.dbValue = eventData.selected[0].propInternalValue;
    newSelectedRevRule.dbValues = [ eventData.selected[0].propInternalValue ];
    newSelectedRevRule.value = eventData.selected[0].propInternalValue;
    newSelectedRevRule.uiValue = eventData.selected[0].propDisplayValue;
    newSelectedRevRule.uiValues = [ eventData.selected[0].propDisplayValue ];
    return newSelectedRevRule;
};


/**
 * Retains the selection in a single select widget based on the values of a multi-select widget.
 *
 * @param {Object} singleSelectWidget - The single select widget object.
 * @param {Object} multiSelectWidget - The multi-select widget object.
 * @returns {Object} - The updated single select widget object with the selection retained.
 */
export let retainSelectionInSingleSelectWidget = ( singleSelectWidget, multiSelectWidget ) => {
    const newSingleSelectWidget = _.clone( singleSelectWidget );
    if( multiSelectWidget.dbValues.length === 1 ) {
        newSingleSelectWidget.dbValue = multiSelectWidget.dbValues[0];
        newSingleSelectWidget.dbValues = multiSelectWidget.dbValues;
        newSingleSelectWidget.value = multiSelectWidget.dbValues[0];
        newSingleSelectWidget.uiValue = multiSelectWidget.uiValues[0];
        newSingleSelectWidget.uiValues = multiSelectWidget.uiValues;
    }
    return newSingleSelectWidget;
};

/**
 * Clears the properties of a multi-select widget view model.
 *
 * @param {Object} multiSelectWidgetToClear - The multi-select widget view model to clear.
 * @param {Object} multiSelectedWidget - The multi-selected widget view model.
 * @returns {Object} - The updated multi-select widget view model.
 */
export let clearMultiSelectWidgetVMProps = ( multiSelectWidgetToClear, multiSelectedWidget ) => {
    const newMultiSelectWidget = _.clone( multiSelectWidgetToClear );
    if( multiSelectedWidget.dbValues.length > 1 ) {
        newMultiSelectWidget.dbValue = '';
        newMultiSelectWidget.dbValues = [];
        newMultiSelectWidget.value = '';
        newMultiSelectWidget.uiValue = '';
        newMultiSelectWidget.uiValues = [];
        newMultiSelectWidget.displayValues = [];
    }
    return newMultiSelectWidget;
};

/**
 * This function will return the Soa Input for createRelations
 * @param {Object} changeObject - Change Item Revision
 * @param {Object} selectedObjects - Selected objects which are to be added as Impacted items
 * @return {Object} Input for createOrUpdateRelations service
 */
export let getSoaInputForCreateRelations = function( changeObject, selectedObjects, data ) {
    let secondaryObjects = [];
    let relatedParentUids = [];
    let alreadyImpactedObjects = [];
    _.forEach( selectedObjects, function( proxyObject ) {
        if( proxyObject?.cm0IsAlreadyImpacted === true ) {
            alreadyImpactedObjects.push( proxyObject );
        } else if( proxyObject.props && proxyObject.props.cm0RelatedUsageRevs !== undefined && proxyObject.props.cm0RelatedUsageRevs.dbValues.length > 0 ) {
            let cm0RelatedUsageUids = [];
            let cm0RelatedParentUids = [];
            cm0RelatedUsageUids = proxyObject.props.cm0RelatedUsageRevs.dbValues;
            cm0RelatedParentUids = proxyObject.props.cm0RelatedParentRevs.dbValues;
            _.forEach( cm0RelatedUsageUids, function( relatedUsageUid, index ) {
                let usageObject = clientDataModelSvc.getObject( relatedUsageUid );
                secondaryObjects.push( usageObject );
                relatedParentUids.push( cm0RelatedParentUids[index] );
            } );
        } else {
            let itemRevObject = clientDataModelSvc.getObject( proxyObject.props.cm0ProposedImpactedObject.dbValues[0] );
            secondaryObjects.push( itemRevObject );
            relatedParentUids.push( '' );
        }
    } );

    // Update alreadyImpactedObjects with the objects that are already impacted which is used to show action message.
    data.alreadyImpactedObjects = alreadyImpactedObjects;
    if( alreadyImpactedObjects.length > 0 ) {
        let errMessage = [];
        alreadyImpactedObjects.forEach( ( impactedObject ) => {
            let changeTitle = changeObject.cellHeader2 + ' / ' + changeObject.cellProperties.Revision?.value + ';' + changeObject.cellHeader1;
            errMessage.push( data.i18n.impactedRelationNotCreatedErrorMsg.replace( '{0}', changeTitle ).replace( '{1}', impactedObject.cellHeader1 ) );
        } );
        messageSvc.showError( errMessage.join( '\n' ) );
    }
    let secondaryDatas = [];
    //create input
    _.forEach( secondaryObjects, function( secondaryObject, index ) {
        let secondaryData = {
            secondary: secondaryObject
        };
        if( relatedParentUids[index] !== '' ) {
            secondaryData.properties = [
                {
                    name: 'cm0ParentRevForImpacted',
                    values: [ relatedParentUids[index] ]
                }
            ];
        }
        secondaryDatas.push( secondaryData );
    } );

    return [ {
        relationType: 'CMHasImpactedItem',
        primaryObject: changeObject,
        secondaryData: secondaryDatas
    } ];
};

/**
 * Generates a display name by appending a selection string from Problem Item Lov with 'Imapacted Candidate Items'.
 *
 * @param {Object} title - An object containing i18n string('Imapcted Candidate')
 * @param {string} selection - The selection string to append to the display name.
 * @returns {string} - The concatenated display name and selected object from Problem Item Lov.
 */
export let getDisplayName = function( title, selection, titleForNoSelection ) {
    if( selection === undefined || selection === '' ) {
        return titleForNoSelection?.propertyDisplayName;
    }
    title = title?.propertyDisplayName;
    return title + selection;
};

/**
 * This function is used to remove duplicate column entries.
 * @param {Array} columns - Columns to render.
 * @returns Unique Columns
 */
export let removeDuplicateEntriesForColumns = function( columns ) {
    return columns.reduce( ( newColumnsWithUniqueEntries, currentCol ) => {
        const colObj = newColumnsWithUniqueEntries.find( col => col.propertyName === currentCol.propertyName );
        if( !colObj ) {
            newColumnsWithUniqueEntries.push( currentCol );
        }
        return newColumnsWithUniqueEntries;
    }, [] );
};

export default exports = {
    removeDuplicateEntriesForColumns,
    relevantProducts,
    updateConfigState,
    deleteRelations,
    inputForCreateNotImpactedRelationsCall,
    getChangeObjectUid,
    publishAddImpactedFromCommandViewModel,
    getProblemItemList,
    handleProblemItemSelection,
    loadProbableImpactedTree,
    processRelObjectsJSONResponse,
    getCreateInputToCreteImpactedRelation,
    defaultPasteHandlerForImpactAnalysis,
    calculateColorIndicatorForProbableImpacted,
    calculateColorIndicatorForRelObjectImpacted,
    processPersistedImpactedTableSelection,
    setProbableImpactedTableSelection,
    expandAndSelectFirstLevelTreeNode,
    publishCutRelationFromCommandViewModel,
    deSelectRelationBrowserGraph,
    getProbableImpactedUid,
    setDropTargetOnPersistedImpactedTable,
    tableViewDragOver,
    tableViewDropOver,
    populateData,
    updateParentState,
    updateDataProvidersInParentState,
    updateDPInParentStateOnModelUpdate,
    updateSelections,
    reloadProbableImpactedTable,
    clearTableData,
    isImpactAnalysisLocation,
    dragStartImpactAnalysisFn,
    getReleaseStatusList,
    updateEffectivityListBox,
    updateProductIDListBox,
    getFilteredRevisionRules,
    setRevisionRuleFilter,
    retainSelectionInSingleSelectWidget,
    clearMultiSelectWidgetVMProps,
    getSoaInputForCreateRelations,
    getDisplayName,
    processPersistedObjectsJSONResponse
};
