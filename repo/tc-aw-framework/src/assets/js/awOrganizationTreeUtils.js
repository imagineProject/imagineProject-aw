
// Copyright (c) 2022 Siemens

/**
 * A service that has util methods for the Active Workspace Organization module.
 *
 * @module js/awOrganizationTreeUtils
 */
import uwPropertySvc from 'js/uwPropertyService';
import soaService from 'soa/kernel/soaService';
import AwPromiseService from 'js/awPromiseService';
import filterPanelService from 'js/filterPanelService';
import searchFilterSvc from 'js/aw.searchFilter.service';
import { getSelectedFiltersMap } from 'js/awSearchSublocationService';
import iconService from 'js/iconService';
import localeService from 'js/localeService';
import tableStateService from 'js/awTableStateService';
import msgService from 'js/messagingService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import awTableTreeSvc from 'js/splmTablePublishedTreeService';
import assert from 'assert';
import viewModelObjectService from 'js/viewModelObjectService';
import cdm from 'soa/kernel/clientDataModel';
import awIconService from 'js/awIconService';
import cmm from 'soa/kernel/clientMetaModel';
import dmSvc from 'soa/dataManagementService';
import tcDataManagementService from 'js/tcDataManagementService';
import treeDPReqRespHelper from 'js/treeDataProviderRequestResponseHelper';

var showInactive = false;
var autoExpandNodeUid = [];

var policyIOverride = {
    override: true,
    types: [ {
        name: 'Group',
        properties: [ {
            name: 'name'
        }, {
            name: 'awp0CellProperties'
        }, {
            name: 'object_string'
        }, {
            name: 'awp0ThumbnailImageTicket'
        } ]
    }, {
        name: 'Role',
        properties: [ {
            name: 'role_name'
        }, {
            name: 'awp0CellProperties'
        }, {
            name: 'object_string'
        }, {
            name: 'awp0ThumbnailImageTicket'
        } ]
    }, {
        name: 'User',
        properties: [ {
            name: 'user_name'
        }, {
            name: 'user_id'
        }, {
            name: 'awp0CellProperties'
        }, {
            name: 'object_string'
        }, {
            name: 'awp0ThumbnailImageTicket'
        } ]
    }, {
        name: 'GroupMember',
        properties: [ {
            name: 'group',
            modifiers: [ {
                name: 'withProperties',
                Value: 'true'
            } ]
        }, {
            name: 'role',
            modifiers: [ {
                name: 'withProperties',
                Value: 'true'
            } ]
        }, {
            name: 'user',
            modifiers: [ {
                name: 'withProperties',
                Value: 'true'
            } ]
        }, {
            name: 'awp0CellProperties'
        }, {
            name: 'object_string'
        }, {
            name: 'awp0ThumbnailImageTicket'
        } ]
    } ]
};


/**
 * Load properties to be shown in the tree structure
 * @param {object} data The view model data object
 * @return {object} Output of loadTableProperties
 */
export let loadPropertiesJS = function( data ) {
    var viewModelCollection = data.dataProviders.orgTreeTableDataProvider.getViewModelCollection();
    var loadedVMOs = viewModelCollection.getLoadedViewModelObjects();

    let uids = loadedVMOs.map( function( vmo ) {
        return vmo.uid;
    } ).filter( function( uid ) {
        if( uid !== 'SiteLevel' ) { return uid; }
    } );

    //this method is call to get the object_string property for the object
    //This is the case when we search the node in tree and cdm.getObject is not getting object_string prop, need to get it through getProperties
    ensureObjectString( uids )
        .then( function() {
            loadedVMOs.forEach( function( vmTreeNode ) {
                let obj = cdm.getObject( vmTreeNode.uid );
                if( obj && obj.props ) {
                    vmTreeNode.props = obj.props;
                }
            } );
        } );

    var propertyLoadResult = awTableTreeSvc.createPropertyLoadResult( loadedVMOs );
    return AwPromiseService.instance.resolve( {
        propertyLoadResult: propertyLoadResult
    } );
};

/**
 * Ensures object string property loaded
 *
 * @param {String[]} uidsToLoad - array of uids to load
 * @return {Promise} A promise is return which resolves after 'object_string' properties are loaded
 */
export let ensureObjectString = function( uidsToLoad ) {
    return dmSvc.loadObjects( uidsToLoad ).then( function() {
        return dmSvc.getProperties( uidsToLoad, [ 'object_string' ] );
    } );
};

/**
 * load Properties required to show in tables'
 * @param {Object} propertyLoadInput - Property Load Input
 * @param {Array} loadedVMOs - Loaded View Model Objects
 * @return {Object} propertyLoadResult
 */
export let loadTableProperties = function( propertyLoadInput ) {
    var allChildNodes = [];
    _.forEach( propertyLoadInput.propertyLoadRequests, function( propertyLoadRequest ) {
        _.forEach( propertyLoadRequest.childNodes, function( childNode ) {
            if( !childNode.props ) {
                childNode.props = {};
            }

            if( childNode.id !== 'top' ) {
                allChildNodes.push( childNode );
            }
        } );
    } );

    var propertyLoadResult = awTableTreeSvc.createPropertyLoadResult( allChildNodes );

    return AwPromiseService.instance.resolve( {
        propertyLoadResult: propertyLoadResult
    } );
};


/**
 * Execute logic for selection steps like selecting\de-selecting the node.
 * @param {Object} data - viewModel
 * @param {Object} ctx - context object
 * @param {Object} currentNode - selected node in org tree
 */
export let treeNodeSelected = function( data, selectedObjects, selectionModelMode, selectionData ) {
    if( selectedObjects && selectedObjects.length > 0 ) {
        let newSelectionData = { ...selectionData.getValue() };
        newSelectionData.selected = selectedObjects;
        selectionData.update( newSelectionData );
    } else if( selectedObjects && selectedObjects.length === 0 ) {
        let newSelectionData = { ...selectionData.getValue() };
        newSelectionData.selected = [];
        selectionData.update( newSelectionData );
    }
};

/**
 * Toggles the given org tree node as expanded or collapsed
 * @param {Object} node the node to toggle
 * @param {Boolean} isExpanded true/false if the node is expanded or not
 * @param {Object} data vmData
 */
export let expandNode = function( node, isExpanded ) {
    node.isExpanded = isExpanded;
    eventBus.publish( 'orgTreeTable12.plTable.toggleTreeNode', node );
};


/**
 * Expands the node with adding some delay.
 * @param {*} node
 * @param {*} isExpanded
 */
export let expandNodeDelay = function( node, isExpanded ) {
    setTimeout( function() {
        node.isExpanded = isExpanded;
        eventBus.publish( 'orgTreeTable12.plTable.toggleTreeNode', node );
    }, 200 );
};

/**
 * Return Object of node with uid and type
 *
 * @param {Object} node tree node
 *
 * @returns {Object} node object
 */
var _getObject = function( node ) {
    var uid = null;
    var type = null;
    uid = node.uid;
    type = node.type;
    return { uid: uid, type: type };
};

/**
 * Show message that there are no results found.
 * @param {Object} filterString the search string for the org tree.
 */
var _showNoResultsMessage = function( filterString ) {
    var localTextBundle = localeService.getLoadedText( 'OrganizationMessages' );
    var msg = localTextBundle.noOrgTreeResultsFound;
    msg = msg.replace( '{0}', filterString );
    msgService.showInfo( msg );
};


/**
 * @return{String} User type.
 */
export let getUserType = function() {
    return 'User';
};


/**
 *_nodeIndex method Retruns index of node if exist else return -1
 *
 * @param {String} selectedNodeId current selected node id
 * @param {Array} availableNodes all available childrens of current expanded node
 *
 * @returns {Number} index of node
 */
export let _nodeIndex = function( selectedNodeId, availableNodes ) {
    for( var i = 0; i < availableNodes.length; i++ ) {
        if( selectedNodeId === availableNodes[ i ].id ) {
            return i;
        }
    }
    return -1;
};

/**
 * Common method to process response and return err object
 * @param  {Object}  response - response from SOA
 *
 * @return {Object} 'error' object
 */
export let handleSOAResponseError = function( response ) {
    var err;
    if( response && response.partialErrors ) {
        err = soaService.createError( response.partialErrors );
        err.message = '';
        _.forEach( response.partialErrors, function( partialError ) {
            _.forEach( partialError.errorValues, function( object ) {
                err.message += '<BR/>';
                err.message += object.message;
            } );
        } );
    }
    return err;
};

/**
 * Return rejection Promise object from err object
 * @param  {Object}  err - 'error' object
 *
 * @return {Promise} 'rejection' Promise
 */
export let getRejectionPromise = function( err ) {
    var deferred = AwPromiseService.instance.defer();
    deferred.reject( err );
    return deferred.promise;
};


/**
 * This function generates alternateID using hierarchy.
 * @param {*} vmNode
 * @param {*} parentNode
 * @returns alternate ID
 */
var getUniqueIdForEachNode = function( vmNode, parentNode ) {
    if( parentNode ) {
        return parentNode.alternateID ? vmNode.uid + ',' + parentNode.alternateID : vmNode.uid + ',' + parentNode.uid;
    }
    return vmNode.uid;
};


/**
 * This function generates expandIds which should be expanded.
 * search in pwa and add user, was not expanding parent node, now it is fixed with this function
 * expandIds contains all alternateIDs for parent in hierarchy
 * @param {*} selectedNodes
 * @param {*} expandIds
 */
export const getNodesToBeExpanded = function( selectedNodes, expandIds ) {
    // added check for selectedNodes
    // Usecase - On navigation from other sublocation to Organization, get nodes to be expanded from alternateID
    // Usecase - On navigation from other view mode to tree mode, get nodes to be expanded from alternateID
    // get the hierarchy for expansion from alternateID
    if ( selectedNodes && selectedNodes.uid !== 'SiteLevel' ) {
        expandIds.push( selectedNodes.alternateID );
        var alternateID = _.clone( selectedNodes.alternateID );
        var selectedUID = _.clone( alternateID );
        while ( selectedUID !== 'SiteLevel' ) {
            var firstID = selectedUID.split( ',' )[0];
            var parentID = selectedUID.replace( firstID + ',', '' );
            if( parentID !== 'SiteLevel' ) {
                // push node to expand in expandIds
                expandIds.push( parentID );
            }
            selectedUID = parentID;
        }
    }
};

/**
 * This function expands parent of the selected node when navigated from list mode to tree mode.
 * @param {*} data
 * @param {*} selectionData
 */
export var saveRowExpandedStateOnTreeLoad = function( data, selectionData, searchState ) {
    var gridId = Object.keys( data.grids )[ 0 ];
    var expandIds = [ ];
    if( selectionData.selected ) {
        for ( var i = 0; i < selectionData.selected.length; i++ ) {
            getNodesToBeExpanded( selectionData.selected[i], expandIds );

            //collapse node by setting isExpanded false
            expandNode( selectionData.selected[i], false );
        }
    }
    const grid = data.grids[gridId];
    if( grid && searchState && searchState.expansionStateCaching ) {
        if( grid.gridOptions ) {
            //This is used to set enableExpansionStateCaching property. If prop is not passed from parent component then default value is false.
            //In people tile we want to retain expansion so passed expansionStateCaching prop from orgtree component.
            grid.gridOptions.enableExpansionStateCaching = searchState.expansionStateCaching ? searchState.expansionStateCaching : false;
        }
    }
    for( var i = 0; i < expandIds.length; i++ ) {
        tableStateService.saveRowExpanded( data, gridId, expandIds[i] );
    }
};


/**
 * Reload tree and select newly added node.
 * @param {*} dataProvider
 * @param {*} eventData - used to take newly created node which needs to add in the tree
 * @returns
 */
export const treeNodeCreated = function( eventData, data ) {
    /**
     * 'orgTreeTable12.plTable.reload' event is automatically called selectionChangeEvent with selectedObject = []
     * To manage selectionChangeEvent call I used isTreeReload flag
     */
    if ( eventData && eventData.treeNodeSelection ) {
        var gridId = Object.keys( data.grids )[ 0 ];
        var expandIds = [];

        //length check is added here because treeNodeSelection can be blank array in case of nothing selected in PWA and pannel is pinned.
        if( eventData.treeNodeSelection.length > 0 && eventData.treeNodeSelection[0].levelNdx === 2 ) {
            //when new node add in level2 the expansion is not working peroperly.
            //handling node expansion with autoExpandNodeUid
            var expandIds = [];
            for( var j = 0; j < eventData.treeNodeSelection.length; j++ ) {
                if( eventData.expandTreeNodeSelection ) {
                    //expand the selected node if expandTreeNodeSelection is true.
                    getNodesToBeExpanded( eventData.treeNodeSelection[j], expandIds );
                } else{
                    getNodesToBeExpanded( eventData.treeNodeSelection[j].parent, expandIds );
                }

                //collapse node by setting isExpanded false
                expandNode( eventData.treeNodeSelection[j], false );
            }
            //remove duplicate ids.
            expandIds = [ ...new Set( expandIds ) ];
            for( var i = 0; i < expandIds.length; i++ ) {
                tableStateService.saveRowExpanded( data, gridId, expandIds[i] );
            }
            autoExpandNodeUid = [ ...eventData.treeNodeSelection ];
        } else{
            for( var j = 0; j < eventData.treeNodeSelection.length; j++ ) {
                if( eventData.expandTreeNodeSelection ) {
                    //expand the selected node if expandTreeNodeSelection is true.
                    getNodesToBeExpanded( eventData.treeNodeSelection[j], expandIds );
                } else{
                    getNodesToBeExpanded( eventData.treeNodeSelection[j].parent, expandIds );
                }
            }
            expandIds = [ ...new Set( expandIds ) ];
            for( var i = 0; i < expandIds.length; i++ ) {
                tableStateService.saveRowExpanded( data, gridId, expandIds[i] );
            }
        }

        if( !eventData.expandTreeNodeSelection ) {
            data.dataProviders.orgTreeTableDataProvider.selectionModel.setSelection( [] );
        }

        data.dataProviders.orgTreeTableDataProvider.resetDataProvider();

        if( eventData.expandTreeNodeSelection ) {
            return {
                isTreeReload: true,
                treeNodeSelection: []
            };
        }
        return {
            isTreeReload: true,
            treeNodeSelection: eventData.treeNodeSelection
        };
    }
};

/**
 *
 * @returns Method to set isTreeReload flag
 */
export const setIsTreeReloadFlag = function( ) {
    return false;
};

/**
 * @param {SearchInput} searchInput - search input for SOA
 * @param {ColumnConfigInput} columnConfigInput - column config for SOA
 * @param {SaveColumnConfigData} saveColumnConfigData - save column config for SOA
 * @param {TreeLoadInput} treeLoadInput - tree load input
 * @return {Response} response A response object containing the details of the result.
 */
function getSoaResponse( searchInput, columnConfigInput, saveColumnConfigData, searchState ) {
    return tcDataManagementService.basePerformSearchViewModel( {
        columnConfigInput: columnConfigInput,
        saveColumnConfigData: saveColumnConfigData,
        searchInput: searchInput,
        inflateProperties: false,
        noServiceData: false
    }, policyIOverride )
        .then(
            function( response ) {
                if( response.searchResultsJSON ) {
                    response.searchResults = JSON.parse( response.searchResultsJSON );
                }
                var newResponse = { ...response };
                newResponse.searchFilterMap = response.searchFilterMap;
                newResponse.searchFilterMap = _.forEach( response.searchFilterMap, function( value, name ) {
                    _.forEach( response.searchFilterMap[ name ], function( object ) {
                        object.searchFilterType = 'StringFilter';
                    } );
                } );
                // If node is expanded, processOutput should not be called. Otherwise it will reload the filter panel on each node expansion
                if( searchInput.searchCriteria.parentGroup === undefined ) {
                    processOutput( newResponse, searchState );
                }

                // Create view model objects
                response.searchResults = response.searchResults &&
                    response.searchResults.objects ? response.searchResults.objects
                        .map( function( vmo ) {
                            return viewModelObjectService
                                .createViewModelObject( vmo.uid, 'EDIT', null, vmo );
                        } ) : [];
                return response;
            } );
}

/**
 * Process Search Filters. This method is same as awSearchService.processOutput but
 * we can't use same method as it will be wrong kit dependency.
 *
 * @param {String} data - response from soa
 * @param {Object} searchData search state
 *
 */
export const processOutput = ( data, searchData ) => {
    const newSearchData = { ...searchData.value };
    newSearchData.totalFound = data.totalFound;
    newSearchData.totalLoaded = data.totalLoaded;
    newSearchData.endIndex = data.endIndex;
    newSearchData.startIndex = data.cursor.startIndex;
    newSearchData.cursorInfo = data.cursor;
    newSearchData.cursorInfo.totalFound = data.totalFound;
    newSearchData.cursorInfo.totalLoaded = data.totalLoaded;
    newSearchData.cursorInfoString = JSON.stringify( newSearchData.cursorInfo );
    newSearchData.searchFilterCategories = data.searchFilterCategories;
    newSearchData.additionalSearchInfoMap = data.additionalSearchInfoMap;
    newSearchData.searchFilterMap = data.searchFilterMap ? data.searchFilterMap : {};
    newSearchData.objectsGroupedByProperty = data.objectsGroupedByProperty;
    newSearchData.hasMoreFacetValues = data.additionalSearchInfoMap ? data.additionalSearchInfoMap.categoryHasMoreFacetValuesList : {};

    newSearchData.bulkFiltersApplied = false;

    newSearchData.categories = filterPanelService.getCategories3( newSearchData, !newSearchData.hideRange );
    const appliedFiltersMap = getSelectedFiltersMap( newSearchData.categories );
    const appliedFiltersInfo = searchFilterSvc.buildSearchFiltersFromSearchState( appliedFiltersMap );
    newSearchData.appliedFilterMap = appliedFiltersInfo.activeFilterMap;
    newSearchData.activeFilterMap = appliedFiltersInfo.activeFilterMap;
    newSearchData.categoryInternalToDisplayNameMap = constructCategoryInternalToDisplayNameMap( newSearchData );
    const [ appliedFilters, categories ] = constructAppliedFiltersAndCategoriesWhenEmptyCategoriesAndZeroResults( newSearchData, appliedFiltersInfo.activeFilters );
    newSearchData.appliedFilters = appliedFilters;
    newSearchData.categoriesForRangeSearches = categories;
    delete newSearchData.isFacetSearch;
    delete newSearchData.searchInProgress;
    searchData.update( newSearchData );
};

/**
 * Process Search Filters Categories - if categories are not present in case of "No result Found" for given filter
 *
 * @param {Object} searchState search state
 * @param {Object} currentActiveFilters currentActiveFilters
 * @return {Object} currentActiveFilters, categories
 *
 */
export let constructAppliedFiltersAndCategoriesWhenEmptyCategoriesAndZeroResults = ( searchState, currentActiveFilters ) => {
    let categories = undefined;
    if( searchState && currentActiveFilters && searchState.categories &&
        searchState.categories.length === 0 && currentActiveFilters.length === 0 &&
        searchState.categoryInternalToDisplayNameMap && Object.keys( searchState.categoryInternalToDisplayNameMap ).length > 0 ) {
        let searchFilterCategories = [];
        for( const [ key, value ] of Object.entries( searchState.categoryInternalToDisplayNameMap ) ) {
            let eachObject = {
                internalName: key,
                displayName: value,
                defaultFilterValueDisplayCount: 5
            };
            searchFilterCategories.push( eachObject );
        }
        const inputForGetCategories = {
            searchFilterCategories: searchFilterCategories,
            categoryValues: searchState.searchFilterMap,
            defaultFilterFieldDisplayCountFromSOA: searchState.defaultFilterFieldDisplayCount,
            showRange: true,
            provider: searchState.provider,
            showExtraChips: true
        };
        categories = filterPanelService.getCategories2( inputForGetCategories );
        const activeSelectedFiltersMap = getSelectedFiltersMap( categories );
        const activeFiltersInfo = searchFilterSvc.buildSearchFiltersFromSearchState( activeSelectedFiltersMap );
        return [ activeFiltersInfo.activeFilters, categories ];
    }
    return [ currentActiveFilters, categories ];
};


/**
 * Prepare categoryInternalToDisplayNameMap when searchState.additionalSearchInfoMap.displayNamesOfPropsInFilterMap exist - if categories are not present in case of "No result Found" for given filter
 *
 * @param {Object} searchState search state
 * @return {Object} categoryInternalToDisplayNameMap
 */
export let constructCategoryInternalToDisplayNameMap = ( searchState ) => {
    let searchFilterCategories = searchState.searchFilterCategories;
    let extraSearchFilterCategories = searchState.additionalSearchInfoMap && searchState.additionalSearchInfoMap.displayNamesOfPropsInFilterMap ?
        searchState.additionalSearchInfoMap.displayNamesOfPropsInFilterMap : [];
    let categoryInternalToDisplayNameMap = {};
    for( let index = 0; index < searchFilterCategories.length; index++ ) {
        categoryInternalToDisplayNameMap[ searchFilterCategories[ index ].internalName ] = searchFilterCategories[ index ].displayName;
    }
    for( let idx = 0; idx < extraSearchFilterCategories.length; idx++ ) {
        let internalName = extraSearchFilterCategories[ idx ].split( '|' )[ 0 ];
        let displayName = extraSearchFilterCategories[ idx ].split( '|' )[ 1 ];
        if( !categoryInternalToDisplayNameMap[ internalName ] && internalName && internalName.length > 0 && displayName && displayName.length > 0 ) {
            categoryInternalToDisplayNameMap[ internalName ] = displayName;
        }
    }
    return categoryInternalToDisplayNameMap;
};

/**
 * Build tree result
 * @param {*} searchInput
 * @param {*} columnConfigInput
 * @param {*} saveColumnConfigData
 * @param {*} treeLoadInput
 * @returns treeLoadResult
 */
export let loadTreeTableData = function( searchInput, columnConfigInput, saveColumnConfigData, treeLoadInput, searchState, data ) {
    assert( searchInput, 'Missing search input' );
    assert( treeLoadInput, 'Missing tree load input' );

    return AwPromiseService.instance.resolve( _buildTreeTableStructure( searchInput, columnConfigInput, saveColumnConfigData, treeLoadInput, searchState, data ) );
};

/* Call perfromSearchViewModel4 soa
 * Prepare search input for SOA.
 * @param {SearchInput} searchInput - search input for SOA
 * @param {ColumnConfigInput} columnConfigInput - column config for SOA
 * @param {SaveColumnConfigData} saveColumnConfigData - save column config for SOA
 * @param {TreeLoadInput} treeLoadInput - tree load input
 * @return {Promise} A Promise resolved with a 'TreeLoadResult' object containing the details of the result.
 */
function _buildTreeTableStructure( searchInput, columnConfigInput, saveColumnConfigData, treeLoadInput, searchState, grid ) {
    treeLoadInput.grid = grid;

    var soaSearchInput = searchInput;
    var parentNode = treeLoadInput.parentNode;
    var treeLoadOutput = {};

    if( parentNode.type === 'Group' ) {
        soaSearchInput.searchCriteria.parentGroup = parentNode.uid;
    }
    if( parentNode.type === 'Role' ) {
        soaSearchInput.searchCriteria.parentRole = parentNode.uid;
        soaSearchInput.searchCriteria.parentGroup = parentNode.parentID;
    }

    return getSoaResponse( soaSearchInput, columnConfigInput, saveColumnConfigData, searchState ).then( function( response ) {
        var vmNodes = [];
        /**
         * This condition is true for the very first time as we have set up topNodeUid = 'SiteLevel' &
         * If root node is already expanded and loading nodes in pagination so do not need to create top node again
         * This will create custom organization root node.
         */
        if( parentNode.uid === 'SiteLevel' && !parentNode.isExpanded ) {
            var localTextBundle = localeService.getLoadedText( 'OrganizationMessages' );
            var newRootNode = {
                uid: 'SiteLevel',
                displayValue: localTextBundle.Organization,
                name: localTextBundle.Organization,
                type: 'Site',
                location: 'Site',
                props: {
                    object_string: { uiValues: [ localTextBundle.Organization ], dbValues: [ localTextBundle.Organization ] }
                }
            };
            var rootPathNodes = _buildRootPath( newRootNode, response );

            if( rootPathNodes.length > 0 ) {
                treeLoadOutput.rootPathNodes = rootPathNodes;
                treeLoadOutput.newTopNode = _.first( treeLoadOutput.rootPathNodes );
            }
        }

        //Process SOA Json result if if its not empty.
        if( !_.isEmpty( response.searchResults ) && response.totalFound !== 0 ) {
            if( response.searchResultsJSON ) {
                var searchResults = JSON.parse( response.searchResultsJSON );
                if( searchResults ) {
                    for( var x = 0; x < searchResults.objects.length; ++x ) {
                        var uid = searchResults.objects[ x ].uid;
                        var obj = cdm.getObject( uid );
                        if( obj ) {
                            vmNodes.push( obj );
                        }
                    }
                }
            }
        } else {
            vmNodes.push( _.first( rootPathNodes ) );
        }

        var treeLoadResult = createTreeLoadResult( response, treeLoadInput, vmNodes );

        _.forEach( treeLoadOutput, function( value, name ) {
            if( !_.isUndefined( value ) ) {
                treeLoadResult[ name ] = value;
            }
        } );
        return AwPromiseService.instance.resolve( {
            treeLoadResult: treeLoadResult
        } );
    } );
}

/**
 * Function to create root node.
 *
 * @param {*} parentModelObj parentOccurrence of getOccurrences response
 * @param {*} response SOA response
 * @returns{*} rootPath Hierarchy for given parentModelObj
 */
function _buildRootPath( parentModelObj, response ) {
    /**
     * Determine the path to the 'root' occurrence IModelObject starting at the immediate 'parent'
     * object.
     */
    var rootPathNodes = [];
    var rootPathObjects = [];
    var pathModelObject = parentModelObj;

    if( pathModelObject ) {
        rootPathObjects.push( pathModelObject );

        //Need to add pathModelObject again in rootPathObject when root node has childrens inside it.
        //After adding the rootNode Objects into rootPathNodes, we do not need to explicitly add root node in treeNodeResult childNodes.
        //It will automatically show in the tree.
        if( !_.isEmpty( response.searchResults ) && response.totalFound !== 0 ) {
            rootPathObjects.push( pathModelObject );
        }
    }

    var nextLevelNdx = -1;

    for( var ndx = rootPathObjects.length - 1; ndx >= 0; ndx-- ) {
        var currNode = createVMNodeUsingObjectInfo( rootPathObjects[ ndx ], 0, nextLevelNdx++ );
        //Add all tree properties for root node.
        currNode.alternateID = getUniqueIdForEachNode( currNode );
        currNode.isExpanded = true;
        currNode.totalFound = response.totalFound;
        if( response.totalFound > 0 ) {
            currNode.isLeaf = false;
        }
        if( ndx === 0 && response.cursor ) {
            currNode.cursorObject = response.cursor;
        }
        rootPathNodes.push( currNode );
    }


    return rootPathNodes;
}

/**This function is used to create view model tree node
 * @param {Object} obj - object for creating view model tree node.
 * @param {int} childNdx - int value for child index.
 * @param {int} levelNdx - int value for level index.
 * @return {Object} vmNode A view model node object containing the details of the node.
 */
export var createVMNodeUsingObjectInfo = function( obj, childNdx, levelNdx, isLeaf, parentNode, displayName ) {
    var objUid = obj.type === 'GroupMember' ? obj.props.user.dbValues[0] : obj.uid;
    var objType = obj.type === 'GroupMember' ? getUserType() : obj.type;

    if( !displayName ) {
        displayName = obj.type === 'Site' ? obj.name : obj.type === 'Group' ? obj.props.object_string.dbValues[ 0 ].split( '.' )[ 0 ] : //
            obj.type === 'Role' ? obj.props.object_string.dbValues[ 0 ] : obj.type === 'User' ? obj.props.user_name.uiValues[ 0 ] : obj.props.user.uiValues[ 0 ];
    }

    // get Icon for node
    var iconURL = obj.type === 'Site' ? iconService.getTypeIconURL( 'ProjectTeam' ) : awIconService.getTypeIconFileUrl( obj );

    var vmNode = awTableTreeSvc
        .createViewModelTreeNode( objUid, objType, displayName, levelNdx, childNdx, iconURL );
    vmNode.typeIconURL = iconURL;

    vmNode.isLeaf = isLeaf;
    if( obj.type === 'GroupMember' ) {
        vmNode.isLeaf = true;
    }

    vmNode.object = _getObject( obj );
    vmNode.modelType = cmm.getType( objType );

    if( !vmNode.props ) {
        vmNode.props = {};
        // Create property 'Test'
        var vmProp = null;
        vmProp = uwPropertySvc.createViewModelProperty( 'Test', 'Test',
            'STRING', '', '' );
        vmNode.props.Test = vmProp;
    }

    if( obj.type === 'Group' && obj.props.object_string ) {
        vmNode.dbValue = obj.props.object_string.dbValues[ 0 ];
    } else if( obj.type === 'Role' && obj.props.role_name ) {
        vmNode.dbValue = obj.props.role_name.dbValues[ 0 ];
    } else // incase of GroupMember or Site
    {
        vmNode.dbValue = vmNode.displayName;
    }

    if( parentNode ) {
        let parent = { ...parentNode };
        delete parent.children; // deleting children from the parent structure before creating a node else it will create recursive structure
        vmNode.parent = parent;
        vmNode.parentID = parentNode.id;
        vmNode.parentName = parentNode.displayName;
        vmNode.alternateID = getUniqueIdForEachNode( vmNode, parentNode );
        vmNode.parentTotalFound = parentNode.totalFound;
    }

    return vmNode;
};


/**
 * Create Tree Load result.
 * @param {Object} response the response of performSearchViewModel SOA call
 * @param {Object} treeLoadInput the response of performSearchViewModel SOA call
 * @param {Object} vmNodes objects to process ViewModelTreeNode
 * @return {TreeLoadResult} treeLoadResult A treeLoadResult object containing the details of the result.
 */
export let createTreeLoadResult = function( response, treeLoadInput, vmNodes ) {
    var endReachedVar = response.totalLoaded + treeLoadInput.startChildNdx === response.totalFound;

    var tempCursorObject = {
        endReached: endReachedVar,
        startReached: true
    };
    if( response.cursor ) {
        tempCursorObject = response.cursor;
    }
    treeLoadInput.parentNode.totalFound = response.totalFound;
    let searchSnippets = response.additionalSearchInfoMap.searchSnippets ? response.additionalSearchInfoMap.searchSnippets : undefined;
    var treeLoadResult = processProviderResponse( treeLoadInput, vmNodes, true, tempCursorObject.endReached, searchSnippets );
    treeLoadResult.parentNode.cursorObject = tempCursorObject;
    treeLoadResult.parentNode.totalLoaded = response.totalLoaded;
    treeLoadResult.searchResults = response.searchResults;
    treeLoadResult.totalLoaded = response.totalLoaded;
    treeLoadResult.searchFilterCategories = response.searchFilterCategories;
    treeLoadResult.objectsGroupedByProperty = response.objectsGroupedByProperty;
    treeLoadResult.searchFilterMap6 = response.searchFilterMap6;

    return treeLoadResult;
};

/**Process SOA response and build tree load result.
 * @param {TreeLoadInput} treeLoadInput - treeLoadInput Parameters for the operation.
 * @param {Object} searchResults - searchResults object processed from SOA call.
 * @param {Boolean} startReached - parameter for the operation.
 * @param {Boolean} endReached - parameter for the operation.
 * @return {TreeLoadResult} treeLoadResult A treeLoadResult object containing the details of the result.
 */
function processProviderResponse( treeLoadInput, searchResults, startReached, endReached, searchSnippets ) {
    // This is the "root" node of the tree or the node that was selected for expansion
    var parentNode = treeLoadInput.parentNode;

    var levelNdx = parentNode.levelNdx + 1;

    var vmNodes = [];
    var vmNode;
    for( var childNdx = 0; childNdx < searchResults.length; childNdx++ ) {
        var object = searchResults[ childNdx ];

        if( !treeDPReqRespHelper.isViewModelTreeNode( object ) ) {
            var isLeaf = searchSnippets ? searchSnippets.includes( object.uid ) : false;
            vmNode = createVMNodeUsingObjectInfo( object, childNdx, levelNdx, isLeaf, parentNode );
            if( vmNode ) {
                /* autoExpandNodeUid field is populated in variable and during node creation it is utilized for expansion of relatedModified node.
                This case will be invoked when node is added to empty of non-expanded node */
                var copyautoExpandNodeUid = [ ...autoExpandNodeUid ];
                for( var i = 0; i < copyautoExpandNodeUid.length; i++ ) {
                    if( copyautoExpandNodeUid[i] && vmNode.alternateID === copyautoExpandNodeUid[i].alternateID && !vmNode.isLeaf ) {
                        vmNode.isExpanded = true;
                        expandNodeDelay( vmNode, true );
                        // Destroying the variable upon expansion of relatedModified node
                        autoExpandNodeUid.splice( i, 1 );
                    }
                }
            }
        } else {
            vmNode = object;
        }
        vmNodes.push( vmNode );
    }

    // Third Paramter is for a simple vs ??? tree
    return awTableTreeSvc.buildTreeLoadResult( treeLoadInput, vmNodes, true, startReached,
        endReached, treeLoadInput.parentNode );
}

/**
 * Set the selection using selection data.
 * If nothing is selected, default root node set as selected.
 * @param {*} dataProvider
 * @param {*} selectionData
 * @param {*} treeNodeSelection - this is newly created node which is return by createVMNodeUsingObjectInfo function and needs to be add in the tree
 */
export const setSelection = ( dataProvider, selectionData, treeNodeSelection  ) => {
    //checking if we have newly created node
    if( treeNodeSelection ) {
        //After adding newly created node in the dataprovider we have to do setSelection
        //So checking alternateId from treeNodeSelection into datProvider and once we have found
        //that node in the tree doing setSelection for that node.
        var selectedNodeArray = [];
        _.forEach( treeNodeSelection, function( object ) {
            var nodeIndex = dataProvider.viewModelCollection.loadedVMObjects.findIndex( ( obj ) => obj.alternateID === object.alternateID );
            var isSelected = dataProvider.selectedObjects.filter( obj => obj.alternateID === object.alternateID );
            if( nodeIndex !== -1 && isSelected.length === 0 ) {
                selectedNodeArray.push( object );
            }
        } );

        if( selectedNodeArray.length > 0 ) {
            dataProvider.selectionModel.addToSelection( selectedNodeArray );
            // filter out already selected nodes from treeNodeSelection
            // when I scroll down in the tree after adding new node, it keeps selecting same node again and then cusror again goes to that selection
            // so to avoid this, need to update treeNodeSelection
            return treeNodeSelection.filter( row1 => {
                const valueToMatch = row1.alternateID;
                const hasSameKeyValue = selectedNodeArray.some( row2 => row2.alternateID === valueToMatch );
                return !hasSameKeyValue;
            } );
        }
    } else if( selectionData && selectionData.selected && selectionData.selected.length > 0 && selectionData.selected[0].alternateID ) {
        var alternateID = selectionData.selected[0].alternateID.split( ',' );
        var alternateIDs = selectionData.selected.map( node => node.alternateID );
        var nodeIndex = dataProvider.viewModelCollection.loadedVMObjects.findIndex( ( obj ) => obj.alternateID === alternateIDs[0] );
        //Set the selection if node found in dataprovider
        var isSelected = dataProvider.selectedObjects.filter( obj => obj.alternateID === alternateIDs[0] );
        if( nodeIndex !== -1 && isSelected.length === 0 ) {
            if( alternateIDs[0] === 'SiteLevel' ) {
                //setting the selection to blank if selectionData is SiteLevel.
                dataProvider.selectionModel.setSelection( [] );
            } else{
                dataProvider.selectionModel.setSelection( alternateIDs );
            }
            //Scroll to selected node
            //ToDo - this work only if node is loaded in tree, If node to be selected is yet to load in tree that means it will not work with paginated result.
            //Focus action needs to implement to fix this.
            eventBus.publish( 'plTable.scrollToRow', {
                gridId: 'orgTreeTable12',
                rowUids: [ alternateID[0] ]
            } );
        }
    } else{
        let newSelectionData = { ...selectionData.getValue() };
        selectionData.update( newSelectionData );
        //changing the default selection to blank as Organization is dummy node and throws console error when selected by default.
        dataProvider.selectionModel.setSelection( [] );
    }
};


/**
 * This method calls the search SOA for the org tree.
 * Prepares tree nodes for soa result and update the tree using dataProvider.update
 * @param {*} filterString - In content search string
 * @param {*} data
 * @param {*} dataProvider
 * @returns
 */
export var loadFilteredTreeTableData = function( filterString, data, fields, dataProvider ) {
    // clear all expansion states
    tableStateService.clearAllStates( data, Object.keys( data.grids )[ 0 ] );

    if( filterString === null ) {
        filterString = '';
    }

    /* getFilteredOrganizationTree should be called when
    either
    a. filterString should not be empty ,
    or
    b. activeFilterMap should not be empty
    */
    if( !_.isUndefined( filterString ) && filterString !== '' || !_.isUndefined( fields.searchState.activeFilterMap ) && Object.keys( fields.searchState.activeFilterMap ).length > 0 ) {
        var useInactiveGMPref = setuseInactiveGMPref( fields.searchState );
        var inputToFilterOrgTree = {
            startIndex: 0,
            maxToReturn: 50,
            cursor: {
                startIndex: fields.searchState.cursorInfo.startIndex,
                startReached: fields.searchState.cursorInfo.startReached,
                endIndex: fields.searchState.cursorInfo.endIndex,
                endReached: fields.searchState.cursorInfo.endReached
            },
            focusObjUid: '',
            searchFilterMap: !_.isUndefined( fields.searchState.activeFilterMap ) ? fields.searchState.activeFilterMap : {},
            pagingType: 'GetCurrentPage',
            searchCriteria: {
                useInactiveGMPref: useInactiveGMPref,
                searchString: filterString
            },
            sortCriteria: {
                fieldName: '',
                sortDirection: ''
            }
        };
        // preparing input as per the getFilteredOrganizationTree soa payload
        inputToFilterOrgTree.searchFilterMap = _.forEach( inputToFilterOrgTree.searchFilterMap, function( value, name ) {
            _.forEach( inputToFilterOrgTree.searchFilterMap[ name ], function( object ) {
                object.count = 0;
                object.selected = true;
                delete object.searchFilterType;
            } );
        } );


        return soaService.postUnchecked( 'Internal-OrgMgmt-2023-06-OrganizationManagement',
            'getFilteredOrganizationTree', { input: inputToFilterOrgTree }, policyIOverride ).then(
            function( result ) {
                var newResponse = { ...result };
                // preparing searchFilterMap, as it is required in the processOutput function
                newResponse.searchFilterMap = result.searchFilterMap;
                newResponse.searchFilterMap = _.forEach( result.searchFilterMap, function( value, name ) {
                    _.forEach( result.searchFilterMap[ name ], function( object ) {
                        object.searchFilterType = 'StringFilter';
                    } );
                } );


                // preparing additionalSearchInfoMap, categoryHasMoreFacetValuesList,objectsGroupedByProperty
                newResponse.additionalSearchInfoMap = {};
                newResponse.objectsGroupedByProperty = {};
                newResponse.objectsGroupedByProperty.internalPropertyName = '';
                newResponse.additionalSearchInfoMap.categoryHasMoreFacetValuesList = [];
                newResponse.additionalSearchInfoMap.displayNamesOfPropsInFilterMap = [];


                // When no results found for incontent search string, searchFilterMap is used from payload to show the breadcrumbs
                if( result.totalFound === 0 ) {
                    newResponse.searchFilterMap = result.searchFilterMap;
                    _.forEach( fields.searchState.categoryInternalToDisplayNameMap, function( object, name ) {
                        newResponse.additionalSearchInfoMap.displayNamesOfPropsInFilterMap.push( name + '|' + object );
                    } );
                    if( result.searchFilterMap === undefined ) {
                        newResponse.searchFilterMap = {};
                    }
                }


                // preparing categoryHasMoreFacetValuesList - if the category has more results, it should show more option
                _.forEach( result.searchFilterMap, function( value, name ) {
                    if( result.searchFilterMap[name].length === inputToFilterOrgTree.maxToReturn ) {
                        newResponse.additionalSearchInfoMap.categoryHasMoreFacetValuesList.push( name );
                    }
                } );

                // process search state for search filter categories
                processOutput( newResponse, fields.searchState );
                // handle the error
                var err = handleSOAResponseError( result );
                if( !_.isUndefined( err ) ) {
                    return getRejectionPromise( err );
                }
                var localTextBundle = localeService.getLoadedText( 'OrganizationMessages' );
                var newRootNode = {
                    uid: 'SiteLevel',
                    displayValue: localTextBundle.Organization,
                    name: localTextBundle.Organization,
                    type: 'Site',
                    location: 'Site',
                    props: {
                        object_string: { uiValues: [ localTextBundle.Organization ], dbValues: [ localTextBundle.Organization ] }
                    }
                };
                var rootPathNodes = _buildRootPath( newRootNode, newResponse );

                var parentNode = _.first( rootPathNodes );
                parentNode.isLeaf = false;
                parentNode.levelNdx = 0;

                var orgTree = result.orgTree;
                var vmNodes = [];
                var hideFilters = fields.searchState.hideFilters;


                getVMNodeRecursive( vmNodes, orgTree, parentNode.levelNdx, parentNode );

                parentNode.totalFound = result.totalFound;
                parentNode.children = [ ...vmNodes ];

                if( result.cursor ) {
                    parentNode.cursorObject = result.cursor;
                }

                if( result.totalFound > 0 ) {
                    parentNode.isExpanded = true;
                    vmNodes.unshift( parentNode );
                }else if( result.totalFound === 0 && filterString ) {
                    dataProvider.selectionModel.setSelection( [] );
                    if( !hideFilters ) {
                        _showNoResultsMessage( filterString );
                    }
                }

                let uids = vmNodes.map( function( vmo ) {
                    return vmo.uid;
                } ).filter( function( uid ) {
                    if( uid !== 'SiteLevel' ) { return uid; }
                } );

                //this method is call to get the object_string property for the object
                //This is the case when we search the node in tree and cdm.getObject is not getting object_string prop, need to get it through getProperties
                ensureObjectString( uids )
                    .then( function() {
                        vmNodes.forEach( function( vmTreeNode ) {
                            let obj = cdm.getObject( vmTreeNode.uid );
                            if( obj && obj.props ) {
                                vmTreeNode.props = obj.props;
                            }
                        } );
                    } );


                dataProvider.update( vmNodes );

                var treeLoadResult = { ...data.treeLoadResult };
                treeLoadResult.childNodes = vmNodes;
                return {
                    treeLoadResult: treeLoadResult
                };
            } );
    }

    //If filter string is empty that is if we clear out the incontent search then will call performSearchViewmodel soa using plTable.reload event.
    eventBus.publish( 'orgTreeTable12.plTable.reload' );
};

/**
 * This is recursive function. It iterates orgtree result and build vmNodes in tree level.
 * @param {*} vmNodes
 * @param {*} children
 * @param {*} childNdx
 * @param {*} levelNdx
 * @param {*} parentNode - parentNode
 */
var getVMNodeRecursive = function( vmNodes, orgTree, levelNdx, parentNode ) {
    if ( orgTree.orgTreeNodes.length > 0 ) {
        for( var i = 0; i < orgTree.orgTreeNodes.length; i++ ) {
            var levelIndex = levelNdx + 1;
            var childNode = createChildTreeNode( orgTree.orgTreeNodes[i], i, levelIndex, parentNode );
            vmNodes.push( childNode );
            if( !childNode.isLeaf ) {
                getVMNodeRecursive( vmNodes, orgTree.orgTreeNodes[i].children, levelIndex, childNode );
            }
        }
    }
};

/**
 * Create View model object and using that create tree node.
 * @param {*} orgTreeNode
 * @param {*} childNdx
 * @param {*} levelNdx
 * @param {*} parentNode
 * @returns vmNode
 */
export var createChildTreeNode = function( orgTreeNode, childNdx, levelNdx, parentNode ) {
    var isLeaf = orgTreeNode.isLeaf;
    var orgObject = { ...orgTreeNode.orgObject };
    var uid = orgObject.uid;
    if( orgObject.type === 'User' ) {
        orgObject.uid = orgTreeNode.groupMember.uid;
        orgObject.type = orgTreeNode.groupMember.type;
        orgObject.props = {
            user: {
                dbValues : [ uid ]
            }
        };
    }
    var displayName = orgTreeNode.displayName;
    var vmNode = createVMNodeUsingObjectInfo( orgObject, childNdx, levelNdx, isLeaf, parentNode, displayName );
    if( vmNode && orgTreeNode.children && orgTreeNode.children.orgTreeNodes.length > 0 ) {
        vmNode.isExpanded = !isLeaf;
    }
    return vmNode;
};

/**
useInactiveGMPref-  The flag will be provided as in input to getFilteredOrganizationTree SOA& Awp0OrgTreeProvider. It will return the only active/ or both active & inactive members as per the flag value.
Valid values for useInactiveGMPref are :
true - Server will read the preference 'TC_show_inactive_group_members' and return the members configrued as per the preference value.
false - Server will ignore the preference value and only returns active members.
Other than true/false-  Server will return both active & inactive members (used for people tile)
 * @param {*} searchState
 * @returns useInactiveGMPref
 */
export var setuseInactiveGMPref = function( searchState ) {
    var useInactiveGMPref;
    // useInactiveGMPref is passed in search state only for people tile as it shows both active and inactive GM
    // value for useInactiveGMPref is passed as 'null' for organization tree in people tile
    if( typeof searchState.useInactiveGMPref !== 'undefined' ) {
        useInactiveGMPref = searchState.useInactiveGMPref;
    }else{
        // otherwise useInactiveGMPref will be true as it should not show inactive GM based on the preference in
        // project tile for Add/Remove Team members , active folders
        useInactiveGMPref = 'true';
    }
    return useInactiveGMPref;
};

const awOrganizationTreeUtils = {
    loadPropertiesJS,
    loadTableProperties,
    treeNodeSelected,
    expandNode,
    getUserType,
    _nodeIndex,
    handleSOAResponseError,
    getRejectionPromise,
    getUniqueIdForEachNode,
    treeNodeCreated,
    setIsTreeReloadFlag,
    loadTreeTableData,
    setSelection,
    createVMNodeUsingObjectInfo,
    loadFilteredTreeTableData,
    processOutput,
    constructAppliedFiltersAndCategoriesWhenEmptyCategoriesAndZeroResults,
    constructCategoryInternalToDisplayNameMap,
    getNodesToBeExpanded,
    ensureObjectString,
    saveRowExpandedStateOnTreeLoad,
    setuseInactiveGMPref
};

export default awOrganizationTreeUtils;
