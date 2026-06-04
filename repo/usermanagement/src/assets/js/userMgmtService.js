// Copyright (c) 2022 Siemens

/**
 * @module js/userMgmtService
 */
import eventBus from 'js/eventBus';
import _ from 'lodash';
import appCtxService from 'js/appCtxService';
import viewModelObjectService from 'js/viewModelObjectService';
import sessionMgrSvc from 'js/sessionManager.service';
import showGDPRSvc from 'js/gdprConsentData.service';
import AwStateService from 'js/awStateService';
import localeService from 'js/localeService';
import cdm from 'soa/kernel/clientDataModel';
import tcDataManagementService from 'js/tcDataManagementService';
import awSearchService from 'js/awSearchService';
import selectionService from 'js/selection.service';
import dmSvc from 'soa/dataManagementService';
import awOrganizationTreeUtils from 'js/awOrganizationTreeUtils';
import viewModeService from 'js/viewMode.service';
import selectionModelFactory from 'js/selectionModelFactory';
import treeDPReqRespHelper from 'js/treeDataProviderRequestResponseHelper';

let exports = {};
//Navigate context key
var _navigateContext = 'navigate';
var _isFilterSet = false;
var _loadingMsg;
var _organizationCrumbMsg;

/**
 * This function will find the duids in tree mode
 *
 * @function getDuidForTreeMode
 *
 * @param {Object[]} selectedObjects - Selected objects
 * @returns {Object} d_uids
 */
const getDuidForTreeMode = ( selectedObjects ) => {
    //sort the selection based on lvl index to always start finding duid hiearchy from the closest to root to optimize.
    //selectedObjects.sort( ( a, b ) => a.levelNdx - b.levelNdx );
    selectedObjects.sort( ( a, b ) => a.alternateID.length - b.alternateID.length );
    let selectionHierarchyArray = [];

    for( const selObj of selectedObjects ) {
        if( selObj && selObj.alternateID ) {
            const currHierarchy = selObj.alternateID.split( ',' );
            if( currHierarchy.length > 2 ) {
                // We only need d_uids - Remove first and last elements as they are the selected obj and baseSlection respectively
                currHierarchy.splice( 0, 1 );
                //currHierarchy.splice( -1, 1 );
                if( selectionHierarchyArray.length === 0 ) {
                    selectionHierarchyArray = currHierarchy;
                } else if( currHierarchy.length >= selectionHierarchyArray.length ) {
                    selectionHierarchyArray = currHierarchy.filter( function( obj ) { return selectionHierarchyArray.indexOf( obj ) > -1; } );
                } else if( currHierarchy.length < selectionHierarchyArray.length ) {
                    //set new lowest possible hierarchy
                    selectionHierarchyArray = currHierarchy;
                }
            } else {
                return null;
            }
        }
    }

    if( selectionHierarchyArray.length > 0 ) {
        // if no common parents found, return any available selectionHierarchy.
        selectionHierarchyArray.splice( -1, 1 );
        return selectionHierarchyArray.reverse().join( '^' );
    } else if( AwStateService.instance.params.d_uids && !isTreeMode() ) {
        return AwStateService.instance.params.d_uids;
    }
    return null;
};

/**
 * Get input data for Remove Role and User action
 * @param {*} ctx
 * @param {*} commandContext
 * @returns
 */
export let getInputDataForRemoveRoleAndUser = function( ctx, commandContext ) {
    var inputDataStructs = [];
    var map = new Map();
    var i = 0;

    if( !ctx.pselected && ( ctx.ViewModeContext.ViewModeContext === 'TreeView' || ctx.ViewModeContext.ViewModeContext === 'TreeSummaryView' ) ) {
        //if selection in tree view
        for( var i = 0; i < commandContext.selectionData.selected.length; i++ ) {
            var map_key = map.get( commandContext.selectionData.selected[i].parent );
            if( map_key && map_key.length > 0 ) {
                //if key already present in map
                map_key.push( commandContext.selectionData.selected[i] );
                map.set( commandContext.selectionData.selected[i].parent, map_key );
            } else {
                // if key not in map
                map.set( commandContext.selectionData.selected[i].parent, [ commandContext.selectionData.selected[i] ] );
            }
        }
        if( commandContext.selectionData.selected[0].type === 'Role' ) {
            //if selection type is role
            const value = map.values();
            const key = map.keys();
            for( var i = 0; i < map.size; i++ ) {
                inputDataStructs.push( {
                    roles: value.next().value,
                    grp: key.next().value
                } );
            }
        } else if ( commandContext.selectionData.selected[0].type === 'User' ) {
            //if selection type is user
            const itr = map.values();
            for( var i = 0; i < map.size; i++ ) {
                var usersValue = itr.next().value;
                inputDataStructs.push( {
                    users: usersValue,
                    grp: usersValue[0].parent.parent,
                    role: usersValue[0].parent
                } );
            }
        }
    } else if( ctx.mselected[0].type === 'Role' ) {
        //if selection type is role in PWA in non-tree view or SWA
        var group;
        if( ctx.pselected ) {
            //if selection from SWA then set group from pselected
            group = ctx.pselected;
        } else {
            //if selection from PWA then set group from searchState
            group = {
                uid: commandContext.searchState.criteria.groupUID,
                type: 'Group'
            };
        }
        inputDataStructs = [
            {
                roles: ctx.mselected,
                grp: group
            }
        ];
    } else if(  ctx.mselected[0].type === 'User' ) {
        //if selection type is user in PWA in non-tree view or SWA
        var role;
        if( ctx.pselected ) {
            //if selection from SWA then set role from pselected
            role = ctx.pselected;
        } else {
            //if selection from PWA then set role from searchState
            role = {
                uid: commandContext.searchState.criteria.roleUID,
                type: 'role'
            };
        }
        inputDataStructs = [
            {
                users: ctx.mselected,
                grp: {
                    uid: commandContext.searchState.criteria.groupUID,
                    type: 'Group'
                },
                role: role
            }
        ];
    }
    return inputDataStructs;
};

/**
 * Update context with search string
 *
 * @param {Object} searchCriteria - criteria
 */
export let updateCriteria = function( searchCriteria ) {
    _isFilterSet = true;
    var searchContext = appCtxService.getCtx( 'search' );
    searchContext.criteria.searchString = searchCriteria;
    appCtxService.updateCtx( 'search', searchContext );
    eventBus.publish( 'peopleList.loadData' );
};

/**
 * Update data provider with search results
 *
 * @param {Object} data - data
 * @param {Object} dataProvider - data provider
 */
export let updateDataProviders = function( data, dataProvider ) {
    if( _isFilterSet ) {
        _isFilterSet = false;
        dataProvider.update( data.searchResults, data.totalFound );
    }
};

export let sortResults = function( parentUid, searchResults ) {
    //Sort by creation date if the context is set
    var navigationCreateContext = appCtxService.getCtx( _navigateContext + '.' + parentUid );
    if( navigationCreateContext ) {
        //Uids are not references to the actual object
        var getRealUid = function( uid ) {
            var realMo = cdm.getObject( uid );
            if( realMo && realMo.props.awp0Target ) {
                return realMo.props.awp0Target.dbValues[ 0 ];
            }
            return uid;
        };

        //Keep the original ordering for anything that was not created
        var originalOrderingResults = searchResults.filter( function( mo ) {
            var uid = getRealUid( mo.uid );
            return navigationCreateContext.indexOf( uid ) === -1;
        } );

        //For anything that was created order by the creation date (newest first)
        var newOrderingResults = searchResults.filter( function( mo ) {
            var uid = getRealUid( mo.uid );
            return navigationCreateContext.indexOf( uid ) !== -1;
        } ).sort(
            function( a, b ) {
                var uidA = getRealUid( a.uid );
                var uidB = getRealUid( b.uid );
                return navigationCreateContext.indexOf( uidB ) -
                    navigationCreateContext.indexOf( uidA );
            } );

        return newOrderingResults.concat( originalOrderingResults );
    }
    return searchResults;
};

export let loadData = function( searchInput, columnConfigInput, saveColumnConfigData, inflateProp, ___, enableAccScroll, startIndex ) {
    if ( enableAccScroll ) {
        if ( searchInput.pagingType === 'GetPreviousPage' && startIndex === 0 ) {
            searchInput.cursor.startIndex = startIndex + searchInput.maxToReturn;
        } else if ( searchInput.pagingType === 'GetNextPage' ) {
            searchInput.cursor.endIndex = startIndex - 1;
        }
    }
    return tcDataManagementService.basePerformSearchViewModel( {
        columnConfigInput: columnConfigInput,
        saveColumnConfigData: saveColumnConfigData,
        searchInput: searchInput,
        inflateProperties: inflateProp,
        noServiceData: false
    } )
        .then(
            function( response ) {
                if( response.searchResultsJSON ) {
                    response.searchResults = JSON.parse( response.searchResultsJSON );
                    delete response.searchResultsJSON;
                }

                // Create view model objects
                response.searchResults = response.searchResults &&
                    response.searchResults.objects ? response.searchResults.objects
                        .map( function( vmo ) {
                            return viewModelObjectService
                                .createViewModelObject( vmo.uid, 'EDIT', null, vmo );
                        } ) : [];

                // Collect all the prop Descriptors
                var propDescriptors = [];
                _.forEach( response.searchResults, function( vmo ) {
                    _.forOwn( vmo.propertyDescriptors, function( value ) {
                        propDescriptors.push( value );
                    } );
                } );

                // Weed out the duplicate ones from prop descriptors
                response.propDescriptors = _.uniq( propDescriptors, false,
                    function( propDesc ) {
                        return propDesc.name;
                    } );

                //Sort by creation date if the context is set
                response.searchResults = exports.sortResults(
                    searchInput.searchCriteria.parentUid, response.searchResults );
                return response;
            } );
};

/**
 * Return display name
 *
 * @function getDisplayName
 * @memberOf NgControllers.OrgSubLocationCtrl
 *
 * @param {Object} crumbName - crumb
 *
 * @returns {Object} display name
 */
export let getDisplayName = function( crumbName ) {
    var i = crumbName.indexOf( '.' );
    return i === -1 ? crumbName : crumbName.substring( 0, i );
};

/**
 * Return object type
 *
 * @function getDisplayName
 * @memberOf NgControllers.OrgSubLocationCtrl
 *
 * @param {Object} uid - uid
 *
 * @returns {Object} display name
 */
export let getCrumbName = function( uid, missingObjectCrumbs, crumb ) {
    var obj = cdm.getObject( uid );
    if( obj && obj.props.object_string ) {
        return obj.modelType.displayName + ': ' + exports.getDisplayName( obj.props.object_string.uiValues[ 0 ] );
    } else if( missingObjectCrumbs && crumb ) {
        //Add crumb in missingObjectCrumbs array If obj.props.object_string is undefined.
        //then we fetch object_string through gteProperties.
        missingObjectCrumbs.push( crumb );
    }
};

var _getCrumbs = function( totalFound, missingObjectCrumbs, selectedObjects, selectionModel ) {
    var treeMode = isTreeMode();
    var crumbs = [];
    let xrtMessageTextBundle =  localeService.getLoadedText( 'XRTMessages' );
    let _dataCountLabel = xrtMessageTextBundle.dataCount;
    var crumb = {
        clicked: false,
        displayName:_organizationCrumbMsg + ' ' + '(' + _dataCountLabel.format( totalFound ) + ')',
        selectedCrumb: false,
        showArrow: false,
        onCrumbClick: ( crumb ) => onSelectCrumb( crumb, selectionModel )
    };
    crumbs.push( crumb );
    let d_uid = treeMode ? getDuidForTreeMode( selectedObjects ) : AwStateService.instance.params.d_uids;
    if( d_uid || AwStateService.instance.params.s_uid )  {
        //Groups Roles. Breadcrumb is Organization > Group > Role
        //Show arrow for organization crumb
        crumbs[0].showArrow = true;

        //Prepare crumb from d_uids & s_uid
        if( d_uid ) {
            var d_uidsArray = d_uid.split( '^' );

            d_uidsArray.map( function( uid, idx ) {
                var crumb3 = _.cloneDeep( crumb );
                crumb3.displayName = exports.getCrumbName( uid, missingObjectCrumbs, crumb3 );

                if( idx + 1 < d_uidsArray.length || AwStateService.instance.params.s_uid ) {
                    crumb3.showArrow = true;
                }
                crumb3.scopedUid = uid;
                crumb3.scopedAlternateId = selectedObjects && selectedObjects.length > 0 && selectedObjects[ selectedObjects.length - 1 ].alternateID ?
                    getAlternateId( selectedObjects[ selectedObjects.length - 1 ], idx ) : null;

                crumbs.push( crumb3 );
            } );
        }
    }
    return crumbs;
};

const getAlternateId = ( selectedObject, index ) => {
    var uids = selectedObject.alternateID.split( ',' ).reverse();
    return uids.slice( 0, index + 2 ).reverse().join( ',' );
};

/**
 * Sublocation specific override to build breadcrumb
 *
 * @function buildNavigateBreadcrumb
 * @memberOf NgControllers.NativeSubLocationCtrl
 *
 * @param {String} totalFound - Total number of results in PWA
 * @param {Object[]} selectedObjects - Selected objects
 * @returns {Object} provider
 */
export let buildNavigateBreadcrumb = function( totalFound, selectedObjects, selectionModel ) {
    //If total found is not set show loading message
    /**
     * missingObjectCrumbs - This variable contains the crumb objects which dont have props loaded such as object_string.
     * The props is not available for object in case of search, the nodes loaded in tree after search,
     * and props is not getting with cdm.getObject. so need to used getProperties call to get the props.
     * For this I follow the same from js\aw.navigateBreadCrumbService.js
     */

    var missingObjectCrumbs = [];
    if( totalFound === undefined ) {
        var baseCrumb = {
            displayName: _loadingMsg,
            clicked: false,
            selectedCrumb: true,
            showArrow: false
        };

        return {
            crumbs: [ baseCrumb ]
        };
    }

    var provider = {
        crumbs: _getCrumbs( totalFound, missingObjectCrumbs, selectedObjects, selectionModel )
    };

    //Add selected object crumb
    if( provider.crumbs.length > 0 && selectedObjects && selectedObjects.length === 1 && selectedObjects[0].alternateID !== 'SiteLevel' ) {
        var vmo = selectedObjects[ 0 ];
        var crumb = {
            clicked: false,
            scopedUid: vmo.uid,
            scopedAlternateId: vmo.alternateID ? vmo.alternateID : null,
            selectedCrumb: false,
            showArrow: true
        };

        crumb.displayName = exports.getCrumbName( vmo.uid, missingObjectCrumbs, crumb );

        provider.crumbs.push( crumb );

        //When object is selected, last 2nd crumb should have chevron ahead of it
        var lastSecondCrumb = provider.crumbs[ provider.crumbs.length - 2 ];
        lastSecondCrumb.showArrow = true;
    }

    if( provider.crumbs.length > 0 ) {
        var lastCrumb = provider.crumbs[ provider.crumbs.length - 1 ];

        //Don't show last crumb as link
        lastCrumb.selectedCrumb = true;
        lastCrumb.showArrow = false;
    }

    let uids = missingObjectCrumbs.map( function( crumb ) {
        return crumb.scopedUid;
    } ).filter( function( uid ) {
        return uid;
    } );

    //this method is call to get the object_string property for the object
    //This is the case when we search the node in tree and cdm.getObject is not getting object_string prop, need to get it through getProperties
    return exports.ensureObjectString( uids ) //
        .then( function() {
            missingObjectCrumbs.forEach( function( crumb ) {
                let obj = cdm.getObject( crumb.scopedUid );
                if( obj && obj.props.object_string ) {
                    crumb.displayName = obj.modelType.displayName + ': ' + exports.getDisplayName( obj.props.object_string.uiValues[ 0 ] );
                }
            } );
            return provider;
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
 * Functionality to trigger logout session, once users revoke their consent
 **/
export let revokeGDPRConsentClick = function() {
    showGDPRSvc.recordUserConsent( false ).then( function() {
        sessionMgrSvc.terminateSession();
    }

    );
};

/**
 * Functionality to trigger logout session, once users revoke their consent
 **/
export let cancelRevoke = function( data ) {
    var revokeGDPRConsent = _.clone( data.revokeGDPRConsent );
    revokeGDPRConsent.dbValue = false;
    return revokeGDPRConsent;
};

/**
 * Functionality to trigger after selecting bread crumb
 * Usecase - After clicking link in breadcrumb the d_uids and s_uid will update. On basis of url parameters the selection will change.
 * breadcrumb format - 296 Objects: Organization > Group: Testg1 > Role: TestR1 > User: TestU1
 * The url of the User: TestU1 selection -  d_uid is "Testg1 uid + TestR1 uid" and s_uid is "TestU1 uid".
 * If click on Role: TestR1 the url is updated as d_uid is "Testg1 uid" and s_uid is "TestR1 uid".
 * If click on Group: Testg1 the url is updated as s_uid is "Testg1 uid"
 * @param {Object} crumb - selected bread crumb object
 */
export let onSelectCrumb = function( crumb, selectionModel ) {
    var d_uidsParam = '';
    var s_uidParam = '';

    if( AwStateService.instance.params.d_uids ) {
        var d_uids = AwStateService.instance.params.d_uids.split( '^' );
        var uidIdx = d_uids.indexOf( crumb.scopedUid );

        //For tree mode, preapared d_uid and s_uid from alternateID for selected breadcrumb.
        //This block is invoked in tree mode.
        if( crumb.scopedAlternateId ) {
            var uidArray = crumb.scopedAlternateId.split( ',' );
            d_uidsParam = prepareDuids( uidArray );
            s_uidParam = crumb.scopedAlternateId.split( ',' )[0] !== 'SiteLevel' ? crumb.scopedAlternateId.split( ',' )[0] : null;
        } else{
            //This block is invoked in list mode.
            d_uidsParam = uidIdx !== -1 ? d_uids.slice( 0, uidIdx + 1 ).join( '^' ) : null;
            s_uidParam = d_uidsParam !== crumb.scopedUid && d_uids ? d_uids : null;
        }
    }
    AwStateService.instance.go( '.', {
        d_uids: d_uidsParam,
        s_uid: s_uidParam
    } ).then( function() {
        //selection should change on breadcrumb click.
        setSelectionOnBreadcrumbLink( selectionModel );
    } );
};

var loadConfiguration = function() {
    localeService.getLocalizedText( '/i18n/UIMessages', 'loadingMsg', true ).then(
        function( msg ) {
            _loadingMsg = msg;
        } );
    localeService.getLocalizedText( '/i18n/UsermanagementMessages', 'organizationTitle', true )
        .then( function( msg ) {
            _organizationCrumbMsg = msg;
        } );
};


/**
 * @function processOutput
 * @param {*} data - response
 * @param {*} dataCtxNode - dataCtxNode
 * @param {*} searchData - searchData
 */
export const processOutput = ( data, dataCtxNode, searchData ) => {
    awSearchService.processOutput( data, dataCtxNode, searchData );
};

/**
 * @function processOutputForOrganization - append alternateID in the searchResults
 * to get the viewModelTreeNode Structure of the retained selection when changed view mode from list to tree mode
 * @param {*} data - response
 * @param {*} dataCtxNode - dataCtxNode
 * @param {*} searchData - searchData
 */
export const processOutputForOrganization = ( data, dataCtxNode, searchData ) => {
    const newdata = { ...data };
    _.forEach( newdata.searchResults, function( selection ) {
        selection.alternateID  =  _.join( getAlternateIdFromParams( selection.uid ), ',' );
    } );
    awSearchService.processOutput( newdata, dataCtxNode, searchData );
};


/**
 * select Created Item in list, table, image mode
 *
 * @param {*} selectionModel
 */
export let selectCreatedItem = function( selectionModel ) {
    var newlyCreatedObjCtx = appCtxService.getCtx( 'newlyCreatedObj' );
    if( newlyCreatedObjCtx ) {
        _.forEach( newlyCreatedObjCtx, function( selection ) {
            // added alternateID in the newly created item, so that it could select the new node on the basis of alternateID
            selection.alternateID  =  _.join( getAlternateIdFromParams( selection.uid ), ',' );
        } );
    }
    selectionModelFactory.setSelection( selectionModel, newlyCreatedObjCtx );
};

/**
 * Update 'ActiveWorkspace:xrtContext' in the appCtxService
 *
 * @param {Object} group - group
 * @param {Object} role - role .
 */
const createXrtContext = function( group, role ) {
    return {
        resourceProviderContentType: 'GroupSubobjects',
        groupUID: group,
        roleUID: role ? role : ''
    };
};

export const getSearchCriteriaFromURL = async( selected ) => {
    let searchCriteria = {};
    let xrtContext;
    if( AwStateService.instance.params.d_uids ) {
        var d_uids = AwStateService.instance.params.d_uids.split( '^' );
        var modelObjects = cdm.getObjects( d_uids );
        var loadObjects = [];
        for( var i = 0; i < modelObjects.length; i++ ) {
            if( !modelObjects[ i ] ) {
                loadObjects.push( d_uids[ i ] );
            }
        }
        if( loadObjects.length ) {
            await dmSvc.loadObjects( loadObjects );
            modelObjects = cdm.getObjects( d_uids );
        }
        for( var idx = 0; idx < d_uids.length; idx++ ) {
            if( modelObjects[ idx ].type === 'Group' ) {
                searchCriteria.groupUID = d_uids[ idx ];
                searchCriteria.roleUID = '';
            } else if( modelObjects[ idx ].type === 'Role' ) {
                searchCriteria.roleUID = d_uids[ idx ];
            }
        }
        searchCriteria.resourceProviderContentType = 'GroupSubobjects';
        if( AwStateService.instance.params.s_uid || selected ) {
            xrtContext = createXrtContext( searchCriteria.groupUID, searchCriteria.roleUID );
        }
    } else {
        //revert back to Organization
        searchCriteria.resourceProviderContentType = 'Organization';
        searchCriteria.groupUID = '';
        searchCriteria.roleUID = '';
    }
    return { searchCriteria, xrtContext };
};

export const updateSearchCriteriaAndXrtContext = async( searchStateAtomicDataRef, searchStateUpdater, selectionData ) => {
    let searchState = searchStateAtomicDataRef.getAtomicData();
    let newSearchstate = searchState ? { ...searchState } : undefined;
    if( newSearchstate ) {
        if( !_.isEmpty( selectionData ) ) {
            if( selectionData.source === 'primary' ) {
                newSearchstate.pwaSelection = selectionData.selected ? selectionData.selected : [];
            } else if( selectionData.source === 'base' || selectionData.source === undefined ) {
                newSearchstate.pwaSelection = [];
            }
            selectionService.updateSelection( selectionData.selected, selectionData.pselected );
        }
        const { searchCriteria, xrtContext } = await getSearchCriteriaFromURL( selectionData.selected );

        newSearchstate.criteria = newSearchstate.criteria ? newSearchstate.criteria : {};
        newSearchstate.criteria.resourceProviderContentType = searchCriteria.resourceProviderContentType;
        newSearchstate.criteria.groupUID = searchCriteria.groupUID;
        newSearchstate.criteria.roleUID = searchCriteria.roleUID;
        newSearchstate.xrtContext = xrtContext;
        searchStateUpdater.searchState( newSearchstate );
    }
};

/**
 * Prepare d_uids from alternateID.
 * @param {*} uidArray
 * @returns
 */
function prepareDuids( uidArray ) {
    var d_uids = '';
    var newDuid = '';
    if( uidArray[ uidArray.length - 1 ] ) {
        uidArray.splice( uidArray.length - 1, 1 );
    }

    if( uidArray[ 0 ] ) {
        uidArray.splice( 0, 1 );
    }

    if( uidArray.length > 0 ) {
        uidArray = _.reverse( uidArray );

        _.forEach( uidArray, function( d_uid ) {
            newDuid = newDuid === '' ? newDuid + d_uid : newDuid + '^' + d_uid;
        } );

        d_uids = newDuid;
    }
    return d_uids;
}

/**
 * Function to update d_uids param upon selection
 * @param {*} subPanelContext
 * @param {*} selectionData
 */
export let updateDuidsParamOnSelection = function( subPanelContext ) {
    if( subPanelContext.selectionData && subPanelContext.selectionData.selected && subPanelContext.selectionData.selected.length > 0 ) {
        var selection = subPanelContext.selectionData.selected;
        var selectedNode = selection[ selection.length - 1 ];
        if( selectedNode.type !== 'Site' && selectedNode.alternateID ) {
            var selectedNodeAlternateId = selectedNode.alternateID;
            var uidArray = selectedNodeAlternateId.split( ',' );
            var d_uids = prepareDuids( uidArray );
            AwStateService.instance.go( '.', {
                d_uids: d_uids
            } );
        }
    }
};


/**
 * Usecase - When we change the view mode from tree to any other view, we have to keep the selection
 * This Function is to update the selected node by alternateID.
 * This function clear the tree view selection while unMount to avoid maximum call stack issue.
 * @param {*} selectionModel
 */
export const clearSelection = ( selectionModel ) => {
    if( selectionModel.selectionData ) {
        const tmpSelectionData = { ...selectionModel.selectionData.value };

        var alternateIDs = tmpSelectionData.selected.map( node => node.alternateID );
        const selections = tmpSelectionData.selected.length > 0 ? alternateIDs : [ AwStateService.instance.params.s_uid ];

        tmpSelectionData.selected = [];
        selectionModel.selectionData.update( tmpSelectionData );
        // select node by alternateID as alternateID is added in list, table and image response
        selectionModel.setSelection( selections );
    }
};

/**
 * Prepare alternateID using d_uids & s_uids
 * @returns alternateID
 */
export const getAlternateIdFromParams = ( uid ) => {
    const navigationParam = AwStateService.instance.params;
    let nodeAlternateID = [];

    let d_uidsForNodeSelection = navigationParam.d_uids && navigationParam.d_uids !== navigationParam.s_uid ? navigationParam.d_uids.split( '^' ) : [];
    d_uidsForNodeSelection = _.reverse( d_uidsForNodeSelection ).join();

    if( uid ) {
        nodeAlternateID.push( uid );
    }

    if( d_uidsForNodeSelection !== '' ) {
        nodeAlternateID.push( d_uidsForNodeSelection );
    }

    nodeAlternateID.push( 'SiteLevel' );

    return nodeAlternateID;
};

/**
 * This function is call upon onMount of the org tree component. This function is used to set seletion in org tree.
 * @param {*} selectionData
 * @param {*} selectionModel
 */
export const setSelectionOnLoad = ( selectionData, selectionModel ) => {
    /*
    Usecase 1- When we change view mode from list to tree, we have to maintain the selection.
    we get current selection in selection model.
    and to set that selection in tree mode we prepare alternateID and basis of that update selectionData.
    Usecase 2 - On tree reload, selection model data is empty. so we make selection using alternateID that creates using s_uid & d_uid.
    */
    if( selectionModel.selectionData ) {
        var mSelectedNodes = [];
        const tmpSelectionData = { ...selectionModel.selectionData.value };
        let tmpContext = { ...selectionData.value };
        let newSelection = [];

        var selections = [];
        if( tmpSelectionData.selected && tmpSelectionData.selected.length > 0 ) {
            selections = tmpSelectionData.selected.map( node => node.uid );
        } else if( AwStateService.instance.params.s_uid && AwStateService.instance.params.s_uid !== 'SiteLevel' ) {
            //set the selection if s_uid is present in url and it is not "SiteLevel", selection should be blank if s_uid is undefined or SiteLevel
            selections = [ AwStateService.instance.params.s_uid ];
        }

        selections.forEach( ( selection = '' ) => {
            mSelectedNodes.push(  _.join( getAlternateIdFromParams( selection.split( ',' )[ 0 ] ), ',' ) );
        } );

        /** For multiple selection need to iterate selections */
        for( var i = 0; i < selections.length; i++ ) {
            var selectedNode = viewModelObjectService.constructViewModelObjectFromModelObject( cdm.getObject( selections[i] ) );
            let treeNode = treeDPReqRespHelper.createViewModelTreeNode( selectedNode.uid, selectedNode.type, selectedNode.cellHeader1 );
            treeNode.alternateID = mSelectedNodes[i];
            newSelection.push( treeNode );
        }
        tmpContext.selected = newSelection;
        selectionData.update( tmpContext );
    }
};

/**
 * Usecase -  This function is called upon creation of user/role/group. To make selection of newly added node we prepare alternate ID of new node using parentUid
 * @param {*} selectionData
 * @param {*} eventData - contains uid of newly created node.
 * @param {*} selectionModel
 */
export const reloadOrgTree = function( selectionData, eventData ) {
    //new node will add in selected node, so selected node will be the parent node.
    var rootNode = {
        type: 'Site',
        uid: 'SiteLevel',
        levelNdx: 0
    };
    var parentNode = selectionData.selected.length > 0 ? selectionData.selected[0] : rootNode;
    let tmpContext = { ...selectionData.value };
    var treeNode = {};
    /**
     * Usecase - when we add existing user/role/subgroup using search tab, we have select/multiselect added nodes in PWA.
     */
    //eventData.uid is uid of newly created node
    if( eventData.isRemoved ) {
        return tmpContext.selected;
    } else if( eventData.multipleNodeAdded ) {
        var newNodes = eventData.multipleNodeAdded;
        let newSelection = [];
        //get all the parent nodes in multiselection and create the newly created node with repective parent.
        var parentSelected = eventData.selectedNode && eventData.selectedNode.length > 0 ? eventData.selectedNode : selectionData.selected;
        if( parentSelected.length > 0 ) {
            for( var j = 0; j < parentSelected.length; j++ ) {
                for( var i = 0; i < newNodes.length; i++ ) {
                    var selectedNode = viewModelObjectService.constructViewModelObjectFromModelObject( cdm.getObject( newNodes[i].uid ) );
                    treeNode = awOrganizationTreeUtils.createVMNodeUsingObjectInfo( selectedNode, parentSelected[j].levelNdx + 1, 0, false, parentSelected[j] );
                    newSelection.push( treeNode );
                }
            }
        } else{
            for( var i = 0; i < newNodes.length; i++ ) {
                var selectedNode = viewModelObjectService.constructViewModelObjectFromModelObject( cdm.getObject( newNodes[i].uid ) );
                treeNode = awOrganizationTreeUtils.createVMNodeUsingObjectInfo( selectedNode, parentNode.levelNdx + 1, 0, false, parentNode );
                newSelection.push( treeNode );
            }
        }
        tmpContext.selected = newSelection;
    } else{
        var selectedNode = viewModelObjectService.constructViewModelObjectFromModelObject( cdm.getObject( eventData.uid ) );
        treeNode = awOrganizationTreeUtils.createVMNodeUsingObjectInfo( selectedNode, parentNode.levelNdx + 1, 0, false, parentNode  );

        tmpContext.selected = [ treeNode ];
    }
    return tmpContext.selected;
};

/**
 * Usecase -  This function is called whenever selection changes and it checks whether current selection is different than previous
 * so for pin unpin usecases it checks for closing panel or not based on the selection
 * @param {*} initialSelectionUids - previous selections uid
 * @param {*} initialSelectionCount - previous selection count
 * @param {*} selected - newly selected in pwa
 */
export let checkForInitialSelection = function( initialSelectionUids, initialSelectionCount, selected ) {
    // if selection is empty check for initialSelectionCount
    if( selected.length === 0 ) {
        return initialSelectionCount < selected.length;
    }
    // if we single to multiple selections, panel should not be closed
    if( selected.length > initialSelectionUids.length ) {
        return true;
    }
    // if single or multiple selections, check if selected is present in initialSelectionUids
    // if selections are not included in initialSelectionUids, return true to close panel - it means current selection is different than earlier
    var sameSel = _.filter( selected, function( item ) {
        if( item && item.uid  && initialSelectionUids.includes( item.uid ) ) {
            return item;
        }
    } );

    return sameSel.length <= 0;
};

/**
 * Utility method to get the initial selection Uid string array along with selection count.
 *
 * @param {Array} selection Initial selection array
 * @returns {Object} Initial selection Uid string array along with selection count.
 */
export let cacheMultiSelection = function( selection ) {
    if( !selection || selection.length <= 0 ) {
        return {
            selectedObjectUids : [],
            selectionCount : 0
        };
    }
    var selectionUids = [];
    _.forEach( selection, function( selObj ) {
        if( selObj && selObj.uid ) {
            selectionUids.push( selObj.uid );
        }
    } );

    return {
        selectedObjectUids : selectionUids,
        selectionCount : selectionUids.length
    };
};


export let isTreeMode = () => {
    var viewMode = viewModeService.getViewMode();
    return viewMode === 'TreeView' || viewMode === 'TreeSummaryView';
};
/**
 * This method sets the selection in tree on basis of d_uids and s_uids on breadcrumb link click.
 * @param {*} selectionModel
 */
export const setSelectionOnBreadcrumbLink = ( selectionModel ) => {
    if( selectionModel.selectionData && selectionModel.selectionData.selected && selectionModel.selectionData.selected.length > 0 ) {
        var mSelectedNodes = [];
        const tmpSelectionData = { ...selectionModel.selectionData.value };

        var selection = AwStateService.instance.params.s_uid;
        if( tmpSelectionData.selected[0].uid !== selection ) {
            //Usecase -  on breadcrumb click the selection should change. we first update the d_uid and s_uid through the method onSelectCrumb.
            //then through this method prepare tree node by getting alternateID through url and set the selection for tree.
            //Usecase 2 - on Organization click on breadcrumb the s_uid is undefined and we set tree selection as blank to avoid console error.
            if( isTreeMode() && selection ) {
                mSelectedNodes.push(  _.join( getAlternateIdFromParams( selection ), ',' ) );
            } else if( selection ) {
                mSelectedNodes.push( selection );
            }
            selectionModel.setSelection( mSelectedNodes );
        }
    }
};

loadConfiguration();

export default exports = {
    getInputDataForRemoveRoleAndUser,
    updateCriteria,
    updateDataProviders,
    sortResults,
    loadData,
    getDisplayName,
    getCrumbName,
    buildNavigateBreadcrumb,
    revokeGDPRConsentClick,
    cancelRevoke,
    onSelectCrumb,
    processOutput,
    processOutputForOrganization,
    selectCreatedItem,
    getSearchCriteriaFromURL,
    updateSearchCriteriaAndXrtContext,
    updateDuidsParamOnSelection,
    clearSelection,
    getAlternateIdFromParams,
    setSelectionOnLoad,
    reloadOrgTree,
    checkForInitialSelection,
    cacheMultiSelection,
    ensureObjectString,
    setSelectionOnBreadcrumbLink,
    isTreeMode
};
