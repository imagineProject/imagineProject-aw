// Copyright (c) 2023 Siemens

/**
 *
 * @module js/Pca0FscConfigurationModuleService
 */

import appCtxSvc from 'js/appCtxService';
import awColumnSvc from 'js/awColumnService';
import awPromiseService from 'js/awPromiseService';
import localeService from 'js/localeService';
import pca0Constants from 'js/Pca0Constants';
import _ from 'lodash';
var exports = {};


/**
 * @return {Promise} A Promise that will be resolved with the requested data when the data is available.
 * <pre>
 * {
 *     columnInfos : {AwTableColumnInfoArray} An array of columns related to the row data created by this service.
 * }
 * </pre>
 */
export let loadTreeColumns = function() {
    const localeTextBundle = localeService.getLoadedText( 'ConfiguratorCommonMessages' );

    var deferred = awPromiseService.instance.defer();
    //display name Variability Content or empty?
    var awColumnInfos = [ {
        name: 'object_name',
        displayName: localeTextBundle.moduleHierarchy,
        typeName: 'String',
        width: 360,
        isTreeNavigation: true,
        enableColumnMoving: false,
        enableColumnResizing: false,
        enableColumnMenu: false
    } ];

    awColumnSvc.createColumnInfo( awColumnInfos );

    deferred.resolve( {
        columnConfig: {
            columns: awColumnInfos
        }
    } );

    return deferred.promise;
};

/**
 * Expand parent nodes recursively.
 * @param {Object} treeDataProvider The tree data provider.
 * @param {Object} vmo The view model object.
 * @param {number} currentDepth The current depth.
 */
export let expandParentNodes = async( treeDataProvider, vmo, currentDepth ) => {
    if ( currentDepth <= 0 ) {
        return; // Base case: Stop recursion when depth is reached
    }
    let vmoParentVisible = exports.getVisibleParent( treeDataProvider, vmo );
    if( vmoParentVisible.uid === vmo.parentUID && vmoParentVisible.isExpanded ) {
        return;
    }
    if( vmoParentVisible.uid === vmo.parentUID && !vmoParentVisible.isExpanded ) {
        await treeDataProvider.expandObject( {}, vmoParentVisible );
        vmoParentVisible.isExpanded = true;
    }else  {
        await treeDataProvider.expandObject( {}, vmoParentVisible );
        vmoParentVisible.isExpanded = true;
        // Recursively expand parent nodes
        await expandParentNodes( treeDataProvider, vmo, currentDepth - 1 );
    }
};

/**
 * Set the selection from the current Config Module
 * @param {Object} treeDataProvider the tree dp
 * @param {Object} selectionModel selection Model
 * @param {Object} changeModuleVMO vmo of the incomplete module to be selected
 * @param {Object} eventData event data
 * @returns {Object} emptyObject
 */
export let setConfigModuleSelection = async( treeDataProvider, selectionModel, changeModuleVMO, eventData ) => {
    //clear selection
    treeDataProvider.selectNone();

    let viewModelCollection = treeDataProvider.getViewModelCollection();
    let viewModelObjects = viewModelCollection.getLoadedViewModelObjects();
    var currentContext = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    let currentProductHierarchyDepth = _.get( currentContext, 'appliedSettings.configSettings.props.pca0ProductHierarchyDepth.dbValues' );
    let altUid = currentContext.configurationModuleHierarchy?.split( ':' ).reverse().join( ':' );
    let vmo;
    let emptyModuleVMO = {};

    // When performing cross probing in selection summary, the module uid is passed as an event data to select the module in the module tree.
    if ( eventData && _.get( eventData, 'props.module.uid' ) ) {
        treeDataProvider.topTreeNode.children.forEach( child => {
            if ( child.uid === eventData.props.module.uid ) {
                vmo = child;
            }
        } );
    } else {
        // If changeModuleVMO is not an empty object and if it is not undefined,
        // then it is the next/previous module to be selected
        if ( !_.isUndefined( changeModuleVMO ) && !_.isEmpty( changeModuleVMO ) ) {
            currentContext.moduleChangedByNextPreviousRequired = true;
            appCtxSvc.updateCtx( pca0Constants.FSC_CONTEXT, currentContext );
            vmo = changeModuleVMO;
        } else {
            vmo = _.find( viewModelObjects, { alternateID: altUid } );
            if ( !vmo ) {
                // Set it to root, which it is because root configurationModuleHierarchy is empty as needed by the server
                vmo = _.find( viewModelObjects, { parentUID: '' } );
            }
        }
    }
    //find the vmo in the view model collection, if not there, expand the tree:
    let vmoVisible = _.find( viewModelObjects, { alternateID : vmo.alternateID } );
    if( !vmoVisible ) {
        //find the visible parent of it and expand it
        let vmoParentVisible = exports.getVisibleParent( treeDataProvider, vmo );
        if( vmoParentVisible && !vmoParentVisible.isExpanded ) {
            // When all modules are collapsed, the top node is the only visible node. To proceed to the next/previous module, we must first expand the top node and then expand the parent node.
            // When 'getVisibleParent' is called in this scenario, it only returns the top node.
            // The following condition checks whether the received vmo is that of the top node. If it is, we need to call 'getVisibleParent' again to get the parent node.
            // In other use cases where the top node is not collapsed, we can directly obtain the parent vmo and expand it.
            if( currentProductHierarchyDepth > 2 && vmoParentVisible.uid !== vmo.parentUID ) {
                await treeDataProvider.expandObject( {}, vmoParentVisible );
                vmoParentVisible.isExpanded = true;
                await expandParentNodes( treeDataProvider, vmo, currentProductHierarchyDepth - 2 );
            }else{
                await treeDataProvider.expandObject( {}, vmoParentVisible );
                vmoParentVisible.isExpanded = true;
            }
        }
    }
    selectionModel.setSelection( vmo );
    //update data provider
    treeDataProvider.update( [ ...viewModelObjects ], viewModelObjects.length );
    //returning empty object to reset changeModuleVMO in the data of ViewModel
    //as it should not be used again when the module tree gets loaded everytime
    return emptyModuleVMO;
};

/**
 * This method is used to get the next/previous incomplete module in the module hierarchy tree.
 * @param {String} treeDataProvider - The treeDataProvider
 * @returns {Object} matchingObject - The vmo of next/previous incomplete module in the module hierarchy tree.
 * */
export let getNextPreviousModule = ( treeDataProvider ) => {
    let context = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    const splitAndExtractFirst = ( str ) => str.includes( ':' ) ? str.split( ':' )[0] : str;

    // Get the list of uids of all the incomplete modules
    const incompleteModulesList = context.incompleteFamiliesInfo.incompleteConfigurationModules.map( splitAndExtractFirst );

    // Get the index of the currently selected module
    let currentModuleIndex = treeDataProvider.topTreeNode.children.findIndex( vmo => vmo.selected === true );

    // Determine the direction of the search
    const direction = context.goPrevious ? -1 : 1;

    // Calculate the next or previous index based on the direction
    let index = ( currentModuleIndex + direction + treeDataProvider.topTreeNode.children.length ) % treeDataProvider.topTreeNode.children.length;

    let matchingObject = '';
    // Get the next/previous incomplete module from the treeDataProvider
    // Check if the next/previous module in the treeDataProvider is in the list of incomplete modules.
    while ( !matchingObject ) {
        const currentObject = treeDataProvider.topTreeNode.children[index];

        if ( incompleteModulesList.includes( currentObject.uid ) ) {
            matchingObject = currentObject;
        } else {
            index = ( index + direction + treeDataProvider.topTreeNode.children.length ) % treeDataProvider.topTreeNode.children.length;
        }
    }

    return matchingObject;
};

/**
 * This method returns the next parent not collapsed up the hierarchy up to the root
 * @param {String} treeDataProvider - The treeDataProvider
 * @param {Object} vmo - the vmo to Model
 * @returns {Object} the vmo of next visible parent in the module hierarchy tree.
 * */
export let getVisibleParent = ( treeDataProvider, vmo ) => {
    let viewModelCollection = treeDataProvider.getViewModelCollection();
    let viewModelObjects = viewModelCollection.getLoadedViewModelObjects();
    let ret = viewModelObjects[0];
    let parentAltUid = vmo.alternateID.split( ':' ).slice( 0, -1 ).join( ':' );
    //if we reached the root or the parent is the top, return
    if( parentAltUid === ret.uid || vmo.alternateID === ret.alternateID ) {
        return ret;
    }
    let vmoParentVisible = _.find( viewModelObjects, { alternateID : parentAltUid } );
    //go higher if needed else return the parent node
    if( !vmoParentVisible  ) {
        ret = getVisibleParent( treeDataProvider, _.find( treeDataProvider.topTreeNode.children, { alternateID : parentAltUid } ) );
    } else {
        ret = vmoParentVisible;
    }
    return ret;
};

export default exports = {
    loadTreeColumns,
    expandParentNodes,
    setConfigModuleSelection,
    getNextPreviousModule,
    getVisibleParent
};
