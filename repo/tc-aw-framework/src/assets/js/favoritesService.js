// Copyright (c) 2022 Siemens

/**
 * Note: Many of the the functions defined in this module return a {@linkcode module:angujar~Promise|Promise} object.
 * The caller should provide callback function(s) to the 'then' method of this returned object (e.g. successCallback,
 * [errorCallback, [notifyCallback]]). These methods will be invoked when the associated service result is known.
 *
 * @module js/favoritesService
 */
import cdm from 'soa/kernel/clientDataModel';
import soaSvc from 'soa/kernel/soaService';
import localStorage from 'js/localStorage';
import adpSvc from 'js/adapterService';
import tcDataMgmtSvc from 'js/tcDataManagementService';
var exports = {};

/**
 * Current promise to get favorites. To avoid multiple calls.
 */
var _currentPromise = null;

/**
 * Query the server for the favorites.
 *
 * @returns {Promise} This promise will be 'resolved' or 'rejected' when the service is invoked and its response
 *          data is available.
 */
export let getFavorites = function() {
    if( _currentPromise ) {
        return _currentPromise;
    }
    var inputData = {
        searchInput: {
            providerName: 'Awp0FavoritesProvider',
            searchCriteria: { search: '' },
            startIndex: 0,
            maxToLoad: 10000,
            maxToReturn: 10000,
            searchFilterMap6: {},
            searchSortCriteria: [],
            searchFilterFieldSortType: 'Priority',
            attributesToInflate: [],
            internalPropertyName: ''
        },
        columnConfigInput: {},
        inflateProperties: false
    };
    _currentPromise = tcDataMgmtSvc.basePerformSearchViewModel( inputData ).then( function( response ) {
        _currentPromise = null;
        var newFavs = [];
        if( response.searchResultsJSON ) {
            var jsonObj = JSON.parse( response.searchResultsJSON );
            for( var ii = 0; ii < jsonObj.objects.length; ii++ ) {
                newFavs.push( cdm.getObject( jsonObj.objects[ ii ].uid ) );
            }
        }

        return newFavs;
    } );

    return _currentPromise;
};


let getFavoritesFolderNodeFromStorage = function(  ) {
    let allLocalStates = localStorage.get( 'awTreeTableState' );
    let allLocalStatesJson = JSON.parse( allLocalStates );

    if( allLocalStates && allLocalStatesJson?.AwStandardObjectNavigationTree?.objNavTree ) {
        let objNavTreeNode = allLocalStatesJson.AwStandardObjectNavigationTree.objNavTree;
        for ( const childKeyObjNavTreeNode in objNavTreeNode ) {
            let childOfObjNavTreeNode = cdm.getObject( childKeyObjNavTreeNode );
            if ( childOfObjNavTreeNode  && childOfObjNavTreeNode.type === 'Awp0Folders' ) {
                for ( const childKey in objNavTreeNode[childKeyObjNavTreeNode].nodeStates ) {
                    let firstLevelChild = childKey.split( ',' )[0];
                    let possibleFavoritesFolder = cdm.getObject( firstLevelChild );
                    if ( possibleFavoritesFolder  && possibleFavoritesFolder.type === 'Awp0FavoritesFolder' ) {
                        return possibleFavoritesFolder;
                    }
                }
            } else if ( childOfObjNavTreeNode  && childOfObjNavTreeNode.type === 'Awp0FavoritesFolder' ) {
                return childOfObjNavTreeNode;
            }
        }
    }

    return null;
};


let getFavoritesObjectsAndFavoritesFolderNode = function( ctx ) {
    let favoritesFolderNode = null;
    let favoritesObjects = [];
    for( const element of ctx.relationContext.relationInfo ) {
        if ( element.primaryObject.type === 'Awp0FavoritesFolder' ) {
            favoritesObjects.push( element.secondaryObject );
            if ( favoritesFolderNode === null ) {
                favoritesFolderNode =  element.primaryObject;
            }
        }
    }

    return {
        favoritesObjects : favoritesObjects,
        favoritesFolderNode : favoritesFolderNode
    };
};

/**
 * @param {ctx} ctx - Current context.
 *
 * @returns {Object} that is used to decide subsequent actions.
 */
export let cutFavorites = function( ctx ) {
    let response = getFavoritesObjectsAndFavoritesFolderNode( ctx );

    if ( response.favoritesObjects.length > 0 ) {
        let input = {
            favorites: response.favoritesObjects,
            action: 'remove'
        };

        soaSvc.post( 'Internal-AWS2-2019-06-DataManagement', 'modifyFavorites', input );
    }

    return {
        isFavoritesUpdated : response.favoritesObjects.length > 0,
        hasValidObjectForCut : ctx.relationContext.relationInfo.length > response.favoritesObjects.length,
        favoritesFolderNode : response.favoritesFolderNode
    };
};

/**
 * @param {IModelObjectArray} modelObjs - array of model objects to add to favorites
 *
 * @returns {Object} that is used to decide subsequent actions.
 */
export let addFavorites = function( contextSelectionData, selected ) {
    let modelObjects = contextSelectionData?.selected ? contextSelectionData.selected : contextSelectionData || selected;
    let adaptedModelObjects = adpSvc.getAdaptedObjectsSync( modelObjects );
    let input = {
        favorites: adaptedModelObjects,
        action: 'add'
    };

    soaSvc.post( 'Internal-AWS2-2019-06-DataManagement', 'modifyFavorites', input );

    return {
        isFavoritesUpdated : modelObjects ? modelObjects.length > 0 : false,
        favoritesFolderNode : getFavoritesFolderNodeFromStorage()
    };
};

/**
 * @param {IModelObjectArray} modelObjs - array of model objects to remove from favorites.
 *
 * @returns {Object} that is used to decide subsequent actions.
 */
export let removeFavorites = function( contextSelectionData, selected ) {
    let modelObjects = contextSelectionData?.selected ? contextSelectionData.selected : contextSelectionData || selected;
    let adaptedModelObjects = adpSvc.getAdaptedObjectsSync( modelObjects );
    let input = {
        favorites: adaptedModelObjects,
        action: 'remove'
    };

    soaSvc.post( 'Internal-AWS2-2019-06-DataManagement', 'modifyFavorites', input );

    return {
        isFavoritesUpdated : modelObjects ? modelObjects.length > 0 : false,
        favoritesFolderNode : getFavoritesFolderNodeFromStorage()
    };
};

/**
 * @param {Object} folderResponse - response from the server.
 */
export let getFavoritesUid = function( folderResponse ) {
    let favoritesFolderUid = null;
    folderResponse.objects.forEach( function( obj ) {
        if( obj.type === 'Awp0FavoritesFolder' ) {
            favoritesFolderUid = obj.uid;
        }
    } );
    return favoritesFolderUid;
};

export default exports = {
    getFavorites,
    addFavorites,
    cutFavorites,
    removeFavorites,
    getFavoritesUid
};
