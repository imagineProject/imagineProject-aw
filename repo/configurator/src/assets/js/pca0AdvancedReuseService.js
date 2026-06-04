// Copyright (c) 2023 Siemens

/**
 * @module js/pca0AdvancedReuseService
 */

import appCtxService from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import { constants as veConstants } from 'js/pca0VariabilityExplorerConstants';
import eventBus from 'js/eventBus';
import { getHistory } from 'js/AwHistoryService';
import localeService from 'js/localeService';
import messagingService from 'js/messagingService';
import pca0Constants from 'js/Pca0Constants';
import pca0VariabilityTreeDisplayService from 'js/Pca0VariabilityTreeDisplayService';
import soaSvc from 'soa/kernel/soaService';
import _ from 'lodash';

/**
 * Helper function to update the selected variability object selections.
 * @param {Object} variabilitySelected - Variability selected object.
 * @param {Object} updatedSelection - Updated selection.
 */
let _updateSelectedVariability = ( variabilitySelected, updatedSelection ) => {
    let variabilityData = variabilitySelected.getValue();
    variabilityData = {
        vmoSelected: updatedSelection,
        featureSelected: updatedSelection,
        modelsSelected: [],
        familiesNotExpanded: [],
        userSelectionsPickAndChooseGrid: updatedSelection.map( vmo => vmo.alternateID ) // array of alternateIDs
    };
    variabilitySelected.update( variabilityData );
};

/**
 * Helper function to segregate the rows by type.
 * @param {Array} rows - Array of objects containing the groups, families and features from Soa response.
 * @returns {Object} Object containing the groups, families and features.
 */
const _segregateRowsByType = ( rows ) => {
    const groups = [];
    const families = [];
    const features = [];

    rows.forEach( ( row ) => {
        const { modelType: { typeHierarchyArray } = {} } = row;
        if ( typeHierarchyArray ) {
            switch ( true ) {
                case typeHierarchyArray.includes( 'Cfg0AbsFamilyGroup' ):
                    groups.push( row );
                    break;
                case typeHierarchyArray.includes( 'Cfg0AbsOptionFamily' ) || typeHierarchyArray.includes( 'Cfg0AbsFeatureFamily' ):
                    families.push( row );
                    break;
                case typeHierarchyArray.includes( 'Cfg0AbsOptionValue' ) || typeHierarchyArray.includes( 'Cfg0AbsFeature' ):
                    features.push( row );
                    break;
            }
        }
    } );
    return {
        allGroups: groups,
        allFamilies: families,
        allFeatures: features
    };
};

/**
 * Helper function to remove the objects from the given array of objects.
 * @param {Array} objects - Array of objects.
 * @param {Array} objectsUIDsToBeRemoved - Array of UIDs of the objects to be removed.
 */
const _removeObjects = ( objects, objectsUIDsToBeRemoved ) => {
    let index = 0;
    const uidsToRemove = new Set( objectsUIDsToBeRemoved );
    while ( index < objects.length ) {
        if ( uidsToRemove.has( objects[index].uid ) ) {
            objects.splice( index, 1 );
        } else {
            index++;
        }
    }
};

/**
 * Helper function to find the parent node of the given node fro the SOA response.
 * @param {Object} soaResponse - SOA response.
 * @param {Object} treeDataProvider - Tree data provider.
 * @param {String} uid - UID of the node.
 * @returns {Object} Parent node and it's index in the tree data provider.
 */
const _findParentNodeFromResponse = ( soaResponse, treeDataProvider, uid ) => {
    const parentResponse = soaResponse.variabilityTreeData.find( node => {
        const childrenUids = _.get( node, 'childrenUids' );
        return childrenUids ? childrenUids.includes( uid ) : false;
    } );
    const parentIndex = treeDataProvider.getViewModelCollection().findViewModelObjectById( parentResponse.nodeUid );
    return { parentResponse, parentIndex };
};

/**
 *
 * @param {Array} loadedVMOs - Loaded view model objects.
 * @param {Array} rowsToBeSelected - Array of alternateIDs of the rows to be selected.
 * @param {Map} newObjectsToBeAddedMap - Map of new objects to be added.
 * @param {Array} features - all features of the parent family.
 * @param {Number} familyIndex - Index of the parent family.
 * @param {Object} parentFamily - Parent family of the features.
 * @param {Object} soaResponse - SOA response.
 * @returns {Number} Index of the last feature added to the tree.
 */
const _addFeaturesToTree = ( loadedVMOs, rowsToBeSelected, newObjectsToBeAddedMap, features, familyIndex, parentFamily, soaResponse ) => {
    loadedVMOs[familyIndex].children = loadedVMOs[familyIndex].children ?? [];
    loadedVMOs[familyIndex].isExpanded = true;

    features = features.filter( featureUid => Object.keys( newObjectsToBeAddedMap ).some( key => key.includes( featureUid ) ) );

    const { uid: familyUid, alternateID: familyAlternateID } = parentFamily;

    let insertionIndex = familyIndex + 1;
    features.forEach( featureUid => {
        // Creating the feature node
        const featureTreeNode = pca0VariabilityTreeDisplayService.createViewModelTreeNode(
            veConstants.CONFIG_CONTEXT_KEY, featureUid, 3, familyUid, familyAlternateID, 0, soaResponse
        );
        rowsToBeSelected.push( featureTreeNode.alternateID );
        loadedVMOs.splice( insertionIndex, 0, featureTreeNode );
        loadedVMOs[familyIndex].children.push( featureTreeNode );
        insertionIndex++;
        return featureTreeNode;
    } );

    return familyIndex + features.length + 1;
};

/**
 * Helper function to add the family nodes with it's children to the tree in advanced reuse use case.
 * @param {Array} loadedVMOs - Loaded view model objects.
 * @param {Array} rowsToBeSelected - Array of alternateIDs of the rows to be selected.
 * @param {Map} newObjectsToBeAddedMap - Map of new objects to be added.
 * @param {Object} family - family object.
 * @param {Number} groupIndex - Index of the group.
 * @param {Array} allFeatures - Array of all features.
 * @param {Object} parentGroup - Parent group of the family.
 * @param {Object} soaResponse - SOA response.
 * @returns {Object} Family tree node.
 */
const _addFamiliesWithChildrenToTree = ( loadedVMOs, rowsToBeSelected, newObjectsToBeAddedMap, family, groupIndex, allFeatures, parentGroup, soaResponse ) => {
    let familyIndex = groupIndex + 1;

    // Creating the family node
    let familyTreeNode = pca0VariabilityTreeDisplayService.createViewModelTreeNode(
        veConstants.CONFIG_CONTEXT_KEY, family.uid, 2, parentGroup.uid, parentGroup.alternateID, 0, soaResponse
    );
    rowsToBeSelected.push( familyTreeNode.alternateID );
    loadedVMOs.splice( familyIndex, 0, familyTreeNode );
    loadedVMOs[groupIndex].children.push( familyTreeNode );

    // Checking if the family has children. If yes, adding the features to the tree.
    // else check if family is of type boolean and if yes make leaf property to true otherwise false
    const children = newObjectsToBeAddedMap[family.uid].childrenUids;
    if ( children && children.length > 0 ) {
        familyIndex = _addFeaturesToTree( loadedVMOs, rowsToBeSelected, newObjectsToBeAddedMap, children, familyIndex, familyTreeNode, soaResponse );
        _removeObjects( allFeatures, children );
    } else if ( _.get( family, 'props.cfg0ValueDataType.dbValues.0' ) === 'Boolean' ) {
        familyTreeNode.isLeaf = false;
    }else {
        familyTreeNode.isLeaf = true;
    }
    return familyTreeNode;
};

/**
 * Helper function to add the group nodes with it's children to the tree in advanced reuse use case.
 * @param {Array} loadedVMOs - Loaded view model objects.
 * @param {Array} rowsToBeSelected - Array of alternateIDs of the rows to be selected.
 * @param {Map} newObjectsToBeAddedMap - Map of new objects to be added.
 * @param {Array} allGroups - Array of all groups.
 * @param {Array} allFamilies - Array of all families.
 * @param {Array} allFeatures - Array of all features.
 * @param {Object} soaResponse - SOA response.
 */
const _addGroupsWithChildrenToTree = ( loadedVMOs, rowsToBeSelected, newObjectsToBeAddedMap, allGroups, allFamilies, allFeatures, soaResponse ) => {
    const context = loadedVMOs[0];
    let groupIndex = 1;
    allGroups.forEach( group => {
        // Creating the group node
        const groupTreeNode = pca0VariabilityTreeDisplayService.createViewModelTreeNode(
            veConstants.CONFIG_CONTEXT_KEY, group.uid, 1, context.uid, context.alternateID, 0, soaResponse );
        loadedVMOs.splice( groupIndex, 0, groupTreeNode );

        rowsToBeSelected.push( groupTreeNode.alternateID );
        context.children = context.children ?? [];
        context.children.push( groupTreeNode );

        // Checking if the group has children. If yes, adding the families to the tree.
        let children = newObjectsToBeAddedMap[group.uid].childrenUids;
        if( children && children.length > 0 ) {
            groupTreeNode.isExpanded = true;
            loadedVMOs[groupIndex].children = loadedVMOs[groupIndex].children ?? [];
            children = children.filter( familyUid => Object.keys( newObjectsToBeAddedMap ).some( key => key.includes( familyUid ) ) );
            const newFamilies = children.map( ( familyUid ) => {
                const familyVmo = allFamilies.find( family => family.uid === familyUid );
                return _addFamiliesWithChildrenToTree( loadedVMOs, rowsToBeSelected, newObjectsToBeAddedMap, familyVmo, groupIndex, allFeatures, groupTreeNode, soaResponse );
            } );
            const totalFeaturesAdded = newFamilies.reduce( ( total, family ) => total + ( family.childrenUids ? family.childrenUids.length : 0 ), 0 );
            groupIndex += children.length + totalFeaturesAdded + 1;
            _removeObjects( allFamilies, children );
        } else {
            groupTreeNode.isLeaf = true;
        }
    } );
};

/**
 * Helper function to process the families or features in advanced reuse use case.
 * @param {String} nodeType - Type of the node. (family/feature)
 * @param {Array} loadedVMOs - Loaded view model objects.
 * @param {Array} rowsToBeSelected - Array of alternateIDs of the rows to be selected.
 * @param {Map} newObjectsToBeAddedMap - Map of new objects to be added.
 * @param {Object} treeDataProvider - Tree data provider.
 * @param {Array} allFamilies - Array of all families.
 * @param {Array} allFeatures - Array of all features.
 * @param {Object} soaResponse - SOA response.
 */
const _processFamiliesOrFeatures = ( nodeType, loadedVMOs, rowsToBeSelected, newObjectsToBeAddedMap, treeDataProvider, allFamilies, allFeatures, soaResponse ) => {
    const rowsToIterate = nodeType === 'family' ? allFamilies : allFeatures;
    rowsToIterate.forEach( row => {
        let { parentResponse, parentIndex } = _findParentNodeFromResponse( soaResponse, treeDataProvider, row.uid );
        // When only feature is added and the group is also collapsed, we wont find the family on the tree.
        // In that case we are setting the group as parent node.
        if ( parentIndex === -1 ) {
            ( { parentResponse, parentIndex } = _findParentNodeFromResponse( soaResponse, treeDataProvider, parentResponse.nodeUid ) );
        }

        let parentNode = loadedVMOs[parentIndex];
        parentNode.isLeaf = false;

        const { uid: parentUid, alternateID: parentAlternateID } = parentNode;

        // If the parent is not expanded, We don't need to do anything. Just select the parent node.
        if ( parentNode.isExpanded === false || parentNode.__expandState ) {
            if ( parentNode.__expandState ) {
                treeDataProvider.resetCollapseCache();
            }
            rowsToBeSelected.push( parentAlternateID );
        } else {
            parentNode.isExpanded = true;
            if( nodeType === 'family' ) {
                _addFamiliesWithChildrenToTree( loadedVMOs, rowsToBeSelected, newObjectsToBeAddedMap, row, parentIndex, allFeatures, parentNode, soaResponse );
            } else {
                loadedVMOs[parentIndex].children =  loadedVMOs[parentIndex].children ?? [];
                // Creating the feature node
                const featureTreeNode = pca0VariabilityTreeDisplayService.createViewModelTreeNode(
                    veConstants.CONFIG_CONTEXT_KEY, row.uid, 3, parentUid, parentAlternateID, 0, soaResponse
                );
                rowsToBeSelected.push( featureTreeNode.alternateID );
                loadedVMOs.splice( parentIndex + 1, 0, featureTreeNode );
                loadedVMOs[parentIndex].children.push( featureTreeNode );
            }
        }
    } );
};

/**
 * Helper function to process the nodes received in the SOA response in advanced reuse use case.
 * @param {Array} rowsToBeSelected - Array of alternateIDs of the rows to be selected.
 * @param {Array} loadedVMOs - Loaded view model objects.
 * @param {Object} treeDataProvider - Tree data provider
 * @param {Object} soaResponse - SOA response
 */
const _processNodes = ( rowsToBeSelected, loadedVMOs, treeDataProvider, soaResponse ) => {
    // Getting the model objects of the newly created objects using the allocation UIDs
    const allocationUIDs = new Set( soaResponse.ServiceData.created );
    const newObjectsToBeAddedMap = soaResponse.variabilityTreeData.reduce( ( map, node ) => {
        if ( allocationUIDs.has( node.props.associationObject[0] ) ) {
            map[node.nodeUid] = node;
        }
        return map;
    }, {} );

    soaResponse.resetColumnProperties = true;
    const newObjectUids = Object.keys( newObjectsToBeAddedMap );
    let cdmObjects = cdm.getObjects( newObjectUids );
    // this will skip the null objects
    cdmObjects = cdmObjects.filter( obj => obj !== null );
    // Segregating the rows by type
    let { allGroups, allFamilies, allFeatures } = _segregateRowsByType( cdmObjects );

    if( allGroups.length > 0 ) {
        _addGroupsWithChildrenToTree( loadedVMOs, rowsToBeSelected, newObjectsToBeAddedMap, allGroups, allFamilies, allFeatures, soaResponse );
    }
    if( allFamilies.length > 0 ) {
        // _processFamilies( loadedVMOs, rowsToBeSelected, newObjectsToBeAddedMap, treeDataProvider, allFamilies, allFeatures, soaResponse );
        _processFamiliesOrFeatures( 'family', loadedVMOs, rowsToBeSelected, newObjectsToBeAddedMap, treeDataProvider, allFamilies, allFeatures, soaResponse );
    }
    if( allFeatures.length > 0 ) {
        // _processFeatures( loadedVMOs, rowsToBeSelected, treeDataProvider, allFeatures, soaResponse );
        _processFamiliesOrFeatures( 'feature', loadedVMOs, rowsToBeSelected, newObjectsToBeAddedMap, treeDataProvider, allFamilies, allFeatures, soaResponse );
    }
};

/**
 *   Export APIs section starts
 */
let exports = {};

/**
 * This function will get the history data from the framework api and filter out the given object.
 * @param {Object} currentContext - VMO of the currently opened context
 * @return {Object} Recent Context History data
 */
export const getContextHistoryData = async( currentContext ) => {
    const { histResults } = await getHistory( 'Cfg0ProductItem,Cfg0Dictionary', 'true', '' );
    const filteredResult = histResults.filter( obj => obj.uid !== currentContext.uid );
    return { totalRecentHistoryFound: filteredResult.length, recentHistoryResults: filteredResult };
};

/**
 * This function will filter out the current context from the search results and return the updated search results.
 * @param {Object} response - Search SOA response
 * @param {Object} currentContext - VMO of the currently opened context
 * @return {Object} Updated search results
 */
export const getContextSearchResult = ( response, currentContext ) => {
    const totalResults = response.totalFound;
    const searchResults = JSON.parse( response.searchResultsJSON );

    // Filter out the current context from the search results
    const searchResultsExcludingCurrentContext = searchResults.objects.filter(
        resultObject => resultObject.uid !== currentContext.uid
    );

    // Calculate the adjusted total of results after excluding the current context
    const adjustedTotalResults = totalResults - ( searchResults.objects.length - searchResultsExcludingCurrentContext.length );

    return {
        totalFound: adjustedTotalResults,
        searchResults: searchResultsExcludingCurrentContext
    };
};

/**
 * This function will check if the given sort criteria is undefined. If so, it will return the default sort criteria.
 * @param {Array} sortCriteria - Sort criteria of the table
 * @return {Array} Updated sort criteria
 */
export const getSearchSortCriteria = ( sortCriteria ) => {
    if( _.isUndefined( sortCriteria ) || Array.isArray( sortCriteria ) && sortCriteria.length === 0 ) {
        return [ {
            fieldName: 'object_name',
            sortDirection: 'ASC'
        } ];
    }
    return sortCriteria;
};

/**
 * This function will create/update a boolean flag in the given ctx property.
 * If the flag is not defined, it will be set to true. Otherwise, it will be toggled (changed to the opposite boolean value).
 * @param {string} flagName - Flag name
 * @return {Boolean} Updated reuse flag value
 */
export const toggleReuseFlagInCtx = ( flagName ) => {
    let flagValue = '';
    const context = appCtxService.getCtx( veConstants.CONFIG_CONTEXT_KEY );
    if ( context ) {
        if ( context[flagName] === undefined ) {
            _.set( context, flagName, true );
        } else {
            context[flagName] = !context[flagName];
        }
        appCtxService.updateCtx( veConstants.CONFIG_CONTEXT_KEY, context );
        flagValue = context[flagName];
    }
    return flagValue;
};

/**
 * This function will return the search query based on the search type.
 * @param {string} searchType - Search type.( Any/Context/Dictionary )
 * @return {String} Search query
 */
export const getContextSearchQuery = ( searchType ) => {
    const searchTypeMap = {
        Cfg0ProductItem: '__ProductItem_Name_or_ID',
        Cfg0Dictionary: '__Dictionary_Name_or_ID',
        Any: '__Configuration_Item_Name_or_ID'
    };
    return searchTypeMap[searchType];
};

/**
 * Updates the details of the context and teh view details based on the selected context.
 * @param {Object} selectedContext - The selected context object.
 * @returns {Object} The updated context details with the active view name.
 */
export const updateContextDetailsAndSetView = ( selectedContext ) => {
    return {
        selectedContext: selectedContext || null,
        activeReuseView: selectedContext ? 'picker' : 'search'
    };
};

/**
 * Selects all VMOs in the picker tree unless it is a context or unassigned family group.
 *
 * @param {Object} variabilitySelected - Collection of VMOs selected in the pick and choose panel.
 * @param {Object} treeDataProvider - tree Data provider
 */
export let selectAllInReusePickerView = ( variabilitySelected, treeDataProvider ) => {
    const viewModelObjects = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();

    // Filtering out the context and Unassigned family group and preselected VMOs
    const viewModelObjectsToBeSelected = viewModelObjects
        .filter( vmo =>
            !_.get( vmo, 'modelType.typeHierarchyArray', [] ).includes( pca0Constants.CFG_OBJECT_TYPES.CONF_CONTEXT )
            && vmo.type !== pca0Constants.CFG_OBJECT_TYPES.TYPE_FAMILY_GRP_REVISION
            && vmo.alternateID
        );

    if( viewModelObjectsToBeSelected.length > 0 ) {
        const alternateIDsOfVMOsToBeSelected = viewModelObjectsToBeSelected.map( vmo => vmo.alternateID );

        // Update the viewModelObjects with the isPreselected flag
        _updateSelectedVariability( variabilitySelected, viewModelObjectsToBeSelected );
        treeDataProvider.selectionModel.addToSelection( alternateIDsOfVMOsToBeSelected );
    }
};

/**
 * Deselects all VMOs in the picker tree.
 *
 * @param {Object} variabilitySelected - Collection of VMOs selected in the pick and choose panel.
 * @param {Object} treeDataProvider - tree Data provider
 */
export let clearSelectionsInReusePickerView = ( variabilitySelected, treeDataProvider ) => {
    const { selectionModel } = treeDataProvider;
    const viewModelObjects = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    const initialSelections = selectionModel.getSelection();

    // Map selections to their corresponding ViewModelObjects
    const mappedVMOs = initialSelections.map( selection =>
        viewModelObjects.find( vmo => vmo.alternateID === selection )
    );

    // Filter out selections that are not preselected and map them to their alternateIDs
    const rowsToBeDeSelected = mappedVMOs.filter( selection => !selection.isPreselected ).map( selection => selection.alternateID );
    const rowsToBeSelected = mappedVMOs.filter( selection => selection.isPreselected );
    // Reset variabilityData selections
    _updateSelectedVariability( variabilitySelected, rowsToBeSelected );
    // Update the selectionModel and variabilitySelected with the new data
    selectionModel.removeFromSelection( rowsToBeDeSelected );
};

/**
 * Disables the selection of VMO received in SOA response in the picker tree.
 *
 * @param {Object} treeDataProvider - tree Data provider
 * @param {Object} soaResponse - createAndAddObjects2 SOA response
 * @param {Object} variabilitySelected - Collection of VMOs selected in the pick and choose panel.
 * @param {Object} selectionData - Collection of VMOs selected on the tree.
 */
export let disableSelectionsInReusePickerView = ( treeDataProvider, soaResponse, variabilitySelected, selectionData ) => {
    if( _.get( soaResponse, 'ServiceData.created' ) ) {
        const rowsToBeSelected = [];
        const viewModelObjects = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
        const selectionModel = treeDataProvider.selectionModel;
        const allocationUIDs = new Set( soaResponse.ServiceData.created );
        const contextUID = _.get( viewModelObjects[0], 'uid' );
        const itemsToRemoveFromSelection = [ contextUID, pca0Constants.CFG_OBJECT_TYPES.TYPE_FAMILY_GRP_REVISION ];

        // Get the nodeUid of the newly created objects using the allocation UIDs
        const nodeUIDs = new Set(
            soaResponse.variabilityTreeData
                .filter( node => allocationUIDs.has( node.props.associationObject[0] ) )
                .map( node => node.nodeUid )
        );
        if( nodeUIDs.size > 0 ) {
            // Update the viewModelObjects with the isPreselected flag
            viewModelObjects.forEach( vmo => {
                if ( nodeUIDs.has( vmo.uid ) && !vmo.isPreselected ) {
                    vmo.isPreselected = true;
                    rowsToBeSelected.push( vmo.alternateID );

                    // check if allocated object is of type boolean family
                    // if yes preselect its children
                    if( _.get( vmo, 'modelType.typeHierarchyArray', [] ).includes( pca0Constants.CFG_OBJECT_TYPES.ABS_LITERAL_VALUE_FAMILY ) && _.get( vmo, 'props.cfg0ValueDataType.dbValue' ) === 'Boolean' ) {
                        let booleanFeatureObject;
                        // check if boolean feature loaded and visible, make preselect property to true for boolean feature
                        // else check if boolean feature loaded but not visible, make preselect property
                        // to true in cache entry boolean feature
                        if( _.get( vmo, 'children.length' ) > 0 ) {
                            let booleanFeatureUid = vmo.children[0].uid;
                            booleanFeatureObject = viewModelObjects.find( viewModelObject => viewModelObject.uid === booleanFeatureUid );
                        }else if (   vmo.__expandState ) {
                            booleanFeatureObject = vmo.__expandState.children[0];
                        }
                        if( booleanFeatureObject ) {
                            booleanFeatureObject.isPreselected = true;
                            rowsToBeSelected.push( booleanFeatureObject.alternateID );
                        }
                    }
                }
            } );

            // Adding context node or Unassigned Family group to the nodeUIDs to avoid it being selected.
            nodeUIDs.add( itemsToRemoveFromSelection[0] );
            nodeUIDs.add( itemsToRemoveFromSelection[1] );
            selectionModel.addToSelection( rowsToBeSelected );

            // Checking if Context node or Unassigned Family group is selected. If yes, remove them from the selection.
            const newSelections = [ ...selectionData.selected ];
            const rowsToBeRemovedFromSelection = newSelections
                .filter( selectedNode => selectedNode.alternateID && itemsToRemoveFromSelection.includes( selectedNode.uid ) )
                .map( selectedNode => selectedNode.alternateID );
            if ( rowsToBeRemovedFromSelection.length > 0 ) {
                selectionModel.removeFromSelection( rowsToBeRemovedFromSelection );
            }

            treeDataProvider.update( viewModelObjects );
        }
    }
};

/**
 * Enable the selection and deselect VMO received as input in the picker tree.
 *
 * @param {Object} treeDataProvider - tree Data provider.
 * @param {Object} response - deleteObjects SOA response.
 * @param {Object} allocationUidMap - Map of allocationUid and nodeUid.
 */
export let enableSelectionsInReusePickerView = ( treeDataProvider, response, allocationUidMap ) => {
    if( response.deleted ) {
        const viewModelObjects = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();

        // Getting the Uid of the nodes to be enabled
        const nodeUIDs = response.deleted
            .map( allocationUid => allocationUidMap[allocationUid] )
            .filter( nodeUid => nodeUid !== undefined );

        // Getting the view model objects using nodeUid
        const commonObjects = viewModelObjects.filter( vmo =>
            nodeUIDs.some( nodeUid => vmo.uid === nodeUid )
        );

        if ( commonObjects && commonObjects.length > 0 ) {
            const rowsToBeRemovedFromSelection = [];

            // Update the viewModelObjects with the isPreselected flag
            viewModelObjects.forEach( vmo => {
                if ( commonObjects.includes( vmo ) && vmo.isPreselected ) {
                    vmo.isPreselected = false;
                    rowsToBeRemovedFromSelection.push( vmo.alternateID );
                }
            } );

            treeDataProvider.selectionModel.removeFromSelection( rowsToBeRemovedFromSelection );
            treeDataProvider.update( viewModelObjects );
        }
    }
};

/**
 * This function will call the allocateVariability SOA to allocate the variability.
 * @param {Object} sourceObjects - Copied rows from the table.
 * @param {Object} configPerspective - Config perspective object.
 */
export const allocateVariability = async( sourceObjects, configPerspective ) => {
    const soaInput = {
        perspective: {
            uid: configPerspective.uid,
            type: configPerspective.type
        },
        objectsToAllocate: sourceObjects,
        sortCriteria: [],
        columnFilters: [],
        requestInfo: {
            isAsync: [ 'false' ]
        }
    };
    const response = await soaSvc.postUnchecked( 'Internal-ProductConfiguratorAw-2024-06-ConfiguratorManagement', 'allocateVariability', soaInput );

    // This event is used to update the tree after the advanced reuse operation.
    eventBus.publish( 'Pca0VariabilityExplorerTree.updateTreeAfterReuse', {
        soaResponse: response
    } );

    // Showing the error message to user if there is any.
    if ( response.ServiceData.partialErrors ) {
        const errMessage = messagingService.getSOAErrorMessage( response.ServiceData );
        messagingService.showError( errMessage );
    }

    // This is required
    // The handling of Confirmation message and error message is done by us.
    // If we don't throw something, the framework will show the default confirmation message again.
    throw 'dummy';
};

/**
 * This function will update the tree after the advanced reuse operation.
 * @param {Object} soaResponse - allocateVariability SOA response
 * @param {Object} treeDataProvider - Tree data provider
 */
export const updateTreeAfterReuse = ( soaResponse, treeDataProvider ) => {
    if( _.get( soaResponse, 'ServiceData.created' ) ) {
        let loadedVMOs = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();

        // If the context is collapsed, we are refreshing the whole tree.
        if ( loadedVMOs[0].__expandState ) {
            eventBus.publish( 'variabilityExplorerGrid.plTable.reload' );
            return;
        }

        const rowsToBeSelected = [];
        _processNodes( rowsToBeSelected, loadedVMOs, treeDataProvider, soaResponse );

        treeDataProvider.selectionModel.setSelection( rowsToBeSelected );
        treeDataProvider.update( loadedVMOs );

        // Showing info message to confirm allocation use case.
        const localTextBundle = localeService.getLoadedText( 'ConfiguratorExplorerMessages' );
        messagingService.showInfo( localTextBundle.advancedReuseSuccess );
    }
};

export default exports = {
    getContextHistoryData,
    getContextSearchResult,
    getSearchSortCriteria,
    toggleReuseFlagInCtx,
    getContextSearchQuery,
    updateContextDetailsAndSetView,
    selectAllInReusePickerView,
    clearSelectionsInReusePickerView,
    disableSelectionsInReusePickerView,
    enableSelectionsInReusePickerView,
    allocateVariability,
    updateTreeAfterReuse
};
