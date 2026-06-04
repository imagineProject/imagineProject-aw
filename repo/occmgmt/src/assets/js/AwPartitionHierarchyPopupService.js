// @<COPYRIGHT>@
// ==================================================
// Copyright 2023.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * A service that manages the Partition Filter panel use cases.<br>
 * Note: This module does not return an API object.
 *
 **/

import _ from 'lodash';
import aceViewModelTreeNodeCreateService from 'js/aceViewModelTreeNodeCreateService';
import AwPromiseService from 'js/awPromiseService';
import awTableTreeSvc from 'js/splmTablePublishedTreeService';
import cdm from 'soa/kernel/clientDataModel';
import dialogService from 'js/dialogService';
import messageSvc from 'js/messagingService';
import occmgmtGetSvc from 'js/aceGetService';
import occmgmtSubsetUtils from 'js/occmgmtSubsetUtils';
import recipeHandler from 'js/recipeHandler';
import soaService from 'soa/kernel/soaService';
import tcVmoService from 'js/tcViewModelObjectService';
import viewModelObjectSvc from 'js/viewModelObjectService';


var exports = {};
let _transientSelections = [];
let _expandedNodes = new Map();
let _expandedNodesInWorkset = {};
var _productContextInfo = '';
let _prevSubsetPCI = '';
const _rootElementToPCI = new Map();

const _APPSESSIONWORKSET = 'AppSessionWorkset';
const _PARTITION = 'Partition';
const _TRUE = 'true';
const _WORKSETREVISION = 'WorksetRevision';

/**
 * Get the scheme information for the getOcc input.
 * @param {Object} data Input data object from the view model.
 * @param {Object} scheme Scheme object to get the partitions.
 * @returns {Object} occurrenceScheme object for the getOcc input.
 */
let _getSchemeInformationForGetOccurrenceSoa = function( data, scheme )  {
    let schemeUid = 'AAAAAAAAAAAAAA';
    //For the first time to get the top level partition the scheme information is needed in the SOA input.
    if( data.treeLoadInput.parentNode.uid === 'top' ) {
        schemeUid = scheme.internalName;
    }
    //dummy occurrenceScheme object for soa Input
    return {
        type : 'unKnownType',
        uid : schemeUid
    };
};

/**
 * Check whether the window is reused or not.
 * @param {Object} uid uid of parent node from data.
 * @param {Object} openObjType opened object type.
 * @returns {boolean} whether the window is reused or not.
*/
let isWindowReuse = function( uid, openObjType ) {
    return Boolean( _productContextInfo !== '' && uid === 'top' && !( openObjType === _WORKSETREVISION || openObjType === _APPSESSIONWORKSET ) );
};

/**
 * Get the requestPref information for the getOcc input.
 * @param {Object} data Input data object from the view model.
 * @param {Object} scheme Scheme object to get the partitions.
 * @returns {Object} requestPref object for the getOcc input.
 */
let _getRequestPrefForGetOcc = function( data, scheme ) {
    let requestPref = {
        displayMode: [ 'Tree' ],
        savedSessionMode: [ 'ignore' ],
        jitterFreePropLoad : [ _TRUE ]
    };
    let expandedNodesCsIdsInScheme = [];
    let openObjType = data.subPanelContext.occContext.openedObjectType;

    let rootElementUid = '';

    // In case of workset, the rootline is the subset.
    if( data.subPanelContext.occContext.rootElement ) {
        rootElementUid = data.subPanelContext.occContext.rootElement.uid;
    }

    //Check in the cache whether expanded nodes are available for a give scheme to retain the expansion state in jitter free.
    if(  openObjType === _WORKSETREVISION || openObjType === _APPSESSIONWORKSET ) {
        if( _expandedNodesInWorkset[rootElementUid] !== undefined ) {
            expandedNodesCsIdsInScheme = _expandedNodesInWorkset[rootElementUid][scheme.internalName];
        }
    }else{
        expandedNodesCsIdsInScheme = _expandedNodes[scheme.internalName];
    }

    if( _rootElementToPCI.get( rootElementUid ) === undefined ) {
        requestPref.expandPartitionNoMember = [ _TRUE ];
    }

    //Use case: When user searches and again go back to the tree mode. The expansion state should get maintained in jitter free.
    if( expandedNodesCsIdsInScheme && expandedNodesCsIdsInScheme.length > 0 && data.treeLoadInput.parentNode.uid === 'top' ) {
        requestPref.expandedNodes = expandedNodesCsIdsInScheme;
        requestPref.loadTreeHierarchyThreshold = [ '2147483646' ];
        requestPref.includePath = [ _TRUE ];
    }

    if( isWindowReuse( data.treeLoadInput.parentNode.uid, openObjType ) ) {
        requestPref.userGesture = [ 'PARTITION_SCHEME_CHANGE' ];
    }

    return requestPref;
};

/**
 * Get the cursor information for the getOcc input.
 * @returns {Object} cursor object for the getOcc input.
 */
let _getCursorInformationForGetOccurrenceSoa = function( ) {
    return {
        cursorData: [],
        endIndex: 0,
        endOccUid: '',
        endReached: false,
        pageSize: 250,
        startIndex: 0,
        startOccUid: '',
        startReached: false
    };
};

/**
 * Get the scheme information for the getOcc input.
 * @param {Object} data Input data object from the view model.
 * @param {Object} scheme Scheme object to get the partitions.
 * @param {Object} recipe recipe object.
 * @returns {Object} occurrenceScheme Dummy object for the getOcc input.
 */
let _getSoaInputsForGetOccurrence = function( data, scheme, recipe )  {
    // Populate the partition filter panel specific request prefs in the soa to communicate with server.
    var product = {
        type : 'unKnownType',
        uid : recipe.occContext.rootElement.props.awb0UnderlyingObject.dbValues[0]
    };

    let soaInput = occmgmtGetSvc.getDefaultSoaInput();
    soaInput.inputData.cursor = _getCursorInformationForGetOccurrenceSoa();
    soaInput.inputData.config.productContext = getProductContext( data, recipe );
    soaInput.inputData.config.occurrenceScheme = _getSchemeInformationForGetOccurrenceSoa( data, scheme );
    soaInput.inputData.requestPref = _getRequestPrefForGetOcc( data, scheme );
    soaInput.inputData.product = product;
    soaInput.inputData.parentElement = getParentUid( data.treeLoadInput.parentNode );

    return soaInput;
};

/**
 * Reset the searchedVMNodes/vmNodes in the data.
 * @internal
 * @returns {Object} result.
 */
export let resetResults = function( type )  {
    let result = {};
    // If the state is Search, this means search was performed before and hence we need to clean up the variables.
    if( type === 'search' ) {
        result.searchVMNodes = [];
    }else{
        result.vmNodes = [];
    }
    return result;
};

/**
 * The Action method for the Tree Data Provider to get the partition hierarchy in the panel.
 *
 * @param {Object} data - Input data object from the view model
 * @param {Object} schemeObj - Partition Scheme for which Popup is opened
 * @param {Object} recipe - Current recipe
 * @returns {Object} Partitions along with whole hierarchy.
 */
export let getPartitionHierarchy = function( data, schemeObj, recipe ) {
    if( data.searchBox && data.searchBox !== undefined && data.searchBox.dbValue === '' ) {
        let soaInput = _getSoaInputsForGetOccurrence( data, schemeObj, recipe );
        if( _transientSelections.length > 0 ) {
            var isApplyButtonVisible = _isApplyButtonValidWithCurrentSelection( data.subPanelContext, _transientSelections );
        }

        return soaService.postUnchecked( 'Internal-ActiveWorkspaceBom-2022-06-OccurrenceManagement', 'getOccurrences4', soaInput ).then(
            function( response ) {
                let treeLoadResult = buildTreeBasedOnSoaResponse( response, data );

                let rootElementUid = '';
                if( data.subPanelContext.occContext.rootElement ) {
                    rootElementUid = data.subPanelContext.occContext.rootElement.uid;
                }

                _productContextInfo = treeLoadResult.productContext;

                //In case of multiple subsets, when the subset is changed, we only need the key-value pair corresponding to the new subset UID and its PCI.
                //Hence we clear the old subset key-value pair from the map
                _rootElementToPCI.clear();
                _rootElementToPCI.set( rootElementUid, _productContextInfo.uid );

                return {
                    parentNode: treeLoadResult.parentNode,
                    childNodes: treeLoadResult.childNodes,
                    totalChildCount: treeLoadResult.totalChildCount,
                    startChildNdx: 0,
                    treeLoadResult: treeLoadResult,
                    productContext: treeLoadResult.productContext,
                    isFilteringValid:isApplyButtonVisible
                };
            }
        );
    }
};

/**
 * To find the VMO for the selected subset in filter panel.
 * @param {Object} vmc - View Model Collection
 * @param {Object} vmoUid - VMO UID
 * @returns {Object} VMO
*/
let _findVmoForModelObject = function( vmc, vmoUid ) {
    let moIdx = vmc.findViewModelObjectById( vmoUid );
    var vmo = vmc.getViewModelObject( moIdx );
    if( !vmo ) {
        vmo = cdm.getObject( vmoUid );
    }
    return vmo;
};

/**
 * To get the PCI info for the selected subset in filter panel.
 * @param {Object} vmc - View Model Collection
 * @param {Object} currentVmo - Current View Model Object
 * @returns {Object} subset VMO
*/
let _getSubsetVmoFromSelectedObject = function( vmc, currentVmo ) {
    let worksetUid = vmc.getLoadedViewModelObjects()[0].uid;

    let parentUid = currentVmo.props.awb0Parent.dbValues && currentVmo.props.awb0Parent.dbValues[0];
    if( !_.isEmpty( parentUid ) && parentUid === worksetUid ) {
        return currentVmo;
    }

    return _getSubsetVmoFromSelectedObject( vmc, _findVmoForModelObject( vmc, parentUid ) );
};

/**
 * Get the subset PCI info.
 * @param {Object} subPanelContext recipe object.
 * @returns {bool} if subset is same or not.
 */
let _isSameSubsetClick = function( subPanelContext )  {
    let openObjType = subPanelContext.occContext.openedObjectType;
    if( openObjType === _WORKSETREVISION || openObjType === _APPSESSIONWORKSET ) {
        let currentSubsetPCI = _getSubsetVmoFromSelectedObject( subPanelContext.occContext.vmc,
            _findVmoForModelObject( subPanelContext.occContext.vmc, subPanelContext.occContext.pwaSelection[0].uid ) ).uid;
        if( _prevSubsetPCI === '' ) {
            _prevSubsetPCI = currentSubsetPCI;
        }

        if( _prevSubsetPCI !== currentSubsetPCI ) {
            _prevSubsetPCI = currentSubsetPCI;
            return false;
        }
    }
    return true;
};

/**
 * Get Product Context.
 *
 * @param {Object} data - Input data object from the view model.
 * @param {Object} recipe - recipe Information
 * @return {object} - Product Context.
 */
export function getProductContext( data, recipe ) {
    let productContext = {
        type : 'unknownType',
        uid : 'AAAAAAAAAAAAAA'
    };
    //While launching the wide panel, The filter panel should not honoured the PWA configuration.
    //Once the panel is launched then use that PCI for further expansion.

    if ( _isSameSubsetClick( recipe ) &&  _productContextInfo !== '' ) {
        productContext.type = _productContextInfo.type;
        productContext.uid = _productContextInfo.uid;
    }
    return productContext;
}

/**
 * Get Parent UID.
 *
 * @param {Object} parentNode - Parent Node from Input data object from the view model.
 * @return {object} - Parent UID.
 */
export function getParentUid( parentNode ) {
    return parentNode.uid !== 'top' ? parentNode.uid : '';
}
/**
 * check the getOcc response whether its valid or not to create the partition tree.
 *
 * @param {Object} response - getOcc SOA response
 * @param {Object} data - input data
 * @return {boolean} - Boolean.
 */
function _isGetOccResponseValidToProcess( response, data ) {
    if( response.ServiceData && response.ServiceData.partialErrors  ) {
        let errors = response.ServiceData.partialErrors[0].errorValues;
        if( errors.length > 0 ) {
            for( let iny = 0; iny < errors.length; iny++ ) {
                // For the license check server will send the 280090 error code. Need to through an error popup on the client for user.
                if( errors[iny].code === 280090 ) {
                    var errorMessage = errors[iny].message;
                    //Dont show the empty panel, better to take the user to discovery panel with a proper error massage.
                    occmgmtSubsetUtils.updateSharedDataWithRecipeBeforeNavigate( data.subPanelContext.activeViewSharedData, data.subPanelContext.sharedData, {}, '', 'Awb0DiscoveryFilterCommandSubPanel' );
                }
            }
            messageSvc.showError( errorMessage ? errorMessage : errors[0].message );
            return false;
        }
    }
    return true;
}

/**
 * Build Tree based on the getOccurrences SOA Response.
 * @param {Object} response SOA Response
 * @param {Object} data  - Input data object from the view model.
 * @return {Object} - Tree Structure
 */
export function buildTreeBasedOnSoaResponse( response, data ) {
    var vmNodes = [];
    var productContext = '';
    if( !_.isEmpty( response ) && _isGetOccResponseValidToProcess( response, data ) ) {
        productContext = response.rootProductContext;
        let parentChildrenInfoLength = response.parentChildrenInfos.length;
        for( let inx = 0; inx < parentChildrenInfoLength; inx++ ) {
            let childOccurrenceInfos = response.parentChildrenInfos[inx].childrenInfo;
            let parentUid =  data.treeLoadInput.parentNode;

            //For top level partitions will have a dummy parent but for the child partitions its has to be present in the loaded vmos.
            if( !parentUid.isExpanded && vmNodes.length > 0 ) {
                parentUid = _.filter( vmNodes, function( vmo ) {
                    return vmo.uid === response.parentChildrenInfos[inx].parentInfo.occurrenceId;
                } )[0];
            }

            //The level of child is always one level deep than its parent.
            let childNdx = parentUid.levelNdx + 1;
            var newVMNodes = aceViewModelTreeNodeCreateService.createVMNodesForGivenOccurrences( childOccurrenceInfos,
                childNdx, productContext.uid, null/*elementToPciMap*/, parentUid );

            // As the user expands the parent partitions, add the child partitions to the list of existing VM Nodes.

            if ( data.vmNodes.length > 0 ) {
                vmNodes = data.vmNodes;
            }

            //In case of jitter free response, the tree should get render in a same way as that of normal expansion in tree.
            // For child partitions VMOs need to reverse the created VMO so all leaf level partition will appear in a seq.
            if( inx > 0 ) {
                newVMNodes.reverse();
            }

            //While jitter free expansion of tree, The vmo needs to mark it as expanded if their childrens are present in the getocc response.
            _.forEach( newVMNodes, function( newVMNode ) {
                let found = false;
                let vmNodesLength = vmNodes.length;
                for( let iny = 0; iny < vmNodesLength; iny++ ) {
                    if( newVMNode.parentUid.uid === vmNodes[iny].uid ) {
                        vmNodes.splice( iny + 1, 0, newVMNode );
                        if( !vmNodes[iny].isExpanded ) {
                            vmNodes[iny].isExpanded = true;
                        }
                        found = true;
                        break;
                    }
                }
                if( !found ) {
                    vmNodes.push( newVMNode );
                }
            } );
        }
        //need to set is it a search or normal load method
        data.dispatch( { path: 'data.state.dbValue', value: 'load' } );
    }
    return {
        parentNode: data.treeLoadInput.parentNode,
        childNodes: vmNodes,
        totalChildCount: vmNodes.length,
        startChildNdx: 0,
        productContext: productContext
    };
}
/**
 * Get the partition UID from the View Model Node provided.
 *
 * @param {Object} vmNode - View Model Tree Node
 * @return {Object} partitionUID - partition uid
 */
export let getPartitionUIDFromNode = function( vmNode ) {
    // Get the Partition UID from vmNode
    let partitionUID = undefined;
    if ( vmNode.type !== 'Fgf0PartitionElement' ) {
        partitionUID = vmNode.uid;
    } else {
        var clientObject = cdm.getObject( vmNode.id );
        if ( clientObject ) {
            partitionUID = clientObject.props.awb0UnderlyingObject.dbValues[0];
        }
    }
    return partitionUID;
};

/**
 * When user launch the panel.
 * Get the persistent selection from the recipe and mark it as selected in the tree.
 *
 * @param {Object} vmNodes - View Model Tree Node
 * @param {Object} data - data
 * @param {Object} subPanelContext - subPanelContext
 * @return {boolean} boolean
 */
let _markSelectedPartitionsFromRecipe = function( vmNodes, data, subPanelContext ) {
    let schemeDisplayName = subPanelContext.sharedData.clickedObj.selected.label;
    let isFilterButtonEnable = false;
    if( data.newlySelectedPartitions.length > 0 ) {
        isFilterButtonEnable = true;
    }

    for( let i = 0; i < vmNodes.length; i++ ) {
        // For each Tree Node,get the partition UID and see if that Partition is in the recipe/ newly selected list/ unselected list.
        let vmNode = vmNodes[i];

        // Get the Partition UID from vmNode
        let partitionUID = getPartitionUIDFromNode( vmNode );

        if ( partitionUID ) {
            let operatorType = subPanelContext.sharedData.recipeOperator;
            let partitionInRecipe = [];
            let criteriaValues = [];

            let productContextInfoUID = subPanelContext.occContext.productContextInfo.uid;
            let viewKey = subPanelContext.occContext.viewKey;
            let recipeTerms = _getExistingRecipe( subPanelContext, productContextInfoUID, viewKey );


            // Loop through the recipe terms to see if this particular VMNode (Partition) is in the recipe.
            // If yes, then select the checkbox
            let found = false;
            for( let j = 0; j < recipeTerms.length; j++ ) {
                let recipeTerm = recipeTerms[j];
                if ( recipeTerm.criteriaType === _PARTITION && recipeTerm.criteriaOperatorType !== 'Clear' && _getValueFromDisplayString( recipeTerm.criteriaDisplayValue, true ) === schemeDisplayName ) {
                    // Check if recipeTerm.criteriaValues has partitionUID. If yes, check the checkbox on the corresponding VMNode.
                    criteriaValues = recipeTerm.criteriaValues;
                    partitionInRecipe = _.filter( criteriaValues, function( criteriaValue ) {
                        return criteriaValue === partitionUID;
                    } );
                    // If partition is in the list of criteria values, then check the partition.
                    if ( partitionInRecipe && partitionInRecipe.length > 0 ) {
                        found = true;
                        data.dataProviders.partitionDataProvider.selectionModel.addToSelection( vmNode );
                        _updateSelectionInFo( [ vmNode ], true );
                        break;
                    }
                    //If the filter operators are different then apply button should be enable for a user to toggle the recipe with selected partitions.
                    if( !isFilterButtonEnable && recipeTerm.criteriaOperatorType !== operatorType ) {
                        isFilterButtonEnable = true;
                    }
                }
            }
            //Usecase: Partition might be selected via search
            if( !found ) {
                let partitionVMOs = _transientSelections;
                let partitionInSelection = _.filter( partitionVMOs, function( partitionVmo ) {
                // Get the Partition UID from vmNode
                    let selectedPartitionUID = getPartitionUIDFromNode( partitionVmo );
                    return selectedPartitionUID === partitionUID;
                } );
                // If partition is in the list of criteria values, then check the partition.
                if ( partitionInSelection && partitionInSelection.length > 0 ) {
                    data.dataProviders.partitionDataProvider.selectionModel.addToSelection( vmNode );
                }
            }
            // Loop through the unSelected list and unselect them.
            let unSelectedNodes = data.unSelectedPartitions;
            if ( unSelectedNodes && unSelectedNodes.length > 0 ) {
                let partitionInUnSelectedNodes = _.filter( unSelectedNodes, function( unSelectedNode ) {
                    return getPartitionUIDFromNode( unSelectedNode ) === getPartitionUIDFromNode( vmNode );
                } );
                if ( partitionInUnSelectedNodes && partitionInUnSelectedNodes.length > 0 ) {
                    // Partition in Unselected list; so unselect this partition.
                    vmNode.selected = false;
                    data.dataProviders.partitionDataProvider.selectionModel.removeFromSelection( vmNode );
                    _updateSelectionInFo( [ vmNode ], false );
                }
            }
        }
    }
    return isFilterButtonEnable;
};

/**
 * Get the persistent or transient recipe for a given product.
 *
 * @param {Object} subPanelContext - SubPanelContext
 * @param {Object} productContextInfoUID - PCI of a given open product.
 * @param {Object} viewKey - View key
 * @return {Object} Recipe for a given product.
 */
var _getExistingRecipe = function( subPanelContext, productContextInfoUID, viewKey ) {
    let recipeTerms = [];
    let transientRecipeInfo = recipeHandler.getTransientRecipeInfo( viewKey );
    if( transientRecipeInfo[1] !== undefined ) {
        recipeTerms = transientRecipeInfo[1];
    }
    if( !recipeTerms.length > 0 ) {
        recipeTerms = recipeHandler.getPersistentRecipe( viewKey, productContextInfoUID );
    }
    let activeIndex = 0;
    if( subPanelContext.sharedData.activeGroupIndex > 0 ) {
        activeIndex = subPanelContext.sharedData.activeGroupIndex;
    }
    if( activeIndex < recipeTerms.length ) {
        return recipeTerms[activeIndex].subCriteria;
    }
    return recipeTerms;
};

/**
 * Get partitions from the recipe using display string.
 *
 * @param {Object} recipeDisplayName - RecipeDisplayName
 * @return {Object} - The partition names present in the recipe string.
 */
let _selectedTerms = function( recipeDisplayName ) {
    var recipeValuesString = _getValueFromDisplayString( recipeDisplayName );
    var allSelectedTerms = {};
    if( recipeValuesString ) {
        allSelectedTerms = recipeValuesString.split( '^' );
    }
    return allSelectedTerms;
};

/**
 * Get scheme/Partitions from the transient/ persistent recipe.
 *
 * @param {Object} recipeDisplayName - RecipeDisplayName
 * @param {boolean} isSchemeName - This parameter needs to send if scheme name is expected as a output.
 * @return {Object} - The partition/scheme names present in the recipe string.
 */
let _getValueFromDisplayString = function( recipeDisplayName, isSchemeName ) {
    var value = recipeDisplayName.split( '_$CAT_' );
    if( isSchemeName ) {
        return value[ 0 ];
    }
    return value[ 1 ];
};

/**
 * Loops through the all existing recipes and get all partitions for a given scheme.
 *
 * @param {Object} subPanelContext - subPanelContext
 */
let _getAllPartitionsToCacheFromRecipe = function( subPanelContext ) {
    let recipeTerms = [];
    let criteriaValues = '';
    let schemeDisplayName = subPanelContext.sharedData.clickedObj.selected.label;
    let productContextInfoUID = subPanelContext.occContext.productContextInfo.uid;
    let viewKey = subPanelContext.occContext.viewKey;

    recipeTerms = _getExistingRecipe( subPanelContext, productContextInfoUID, viewKey );
    for( let j = 0; j < recipeTerms.length; j++ ) {
        let recipeTerm = recipeTerms[j];
        if ( recipeTerm.criteriaType === _PARTITION && recipeTerm.criteriaOperatorType !== 'Clear' && _getValueFromDisplayString( recipeTerm.criteriaDisplayValue, true ) === schemeDisplayName ) {
            // There are 2 parallel vectors, 1 for the partition uids and another for the partition names.
            // It is expected that both the vectors will be in a sync so there values will always matches.
            var partitionNames = _selectedTerms( recipeTerm.criteriaDisplayValue );
            criteriaValues = recipeTerm.criteriaValues;
            for( let inx = 1; inx < criteriaValues.length; inx++ ) {
                let dummyPartition = {
                    displayName: partitionNames[inx - 1],
                    uid: criteriaValues[inx],
                    isLeaf: true,
                    levelNdx: 0,
                    iconURL: 'dummyIconURL',
                    typeIconURL: 'dummyTypeIconURL'
                };
                _updateSelectionInFo( [ dummyPartition ], true );
            }
            break;
        }
    }
};

/**
 * Loops through the tree nodes to find out which partitions are in the recipe already and marks those nodes as checked.
 *
 * @param {Object} data - Input data object from the view model
 * @param {Object} subPanelContext - subPanelContext
 * @return {boolean} isFilterOperatorDifferent - to decide the visibility of apply button.
 */
export let checkPartitionsInRecipe = function( data, subPanelContext ) {
    let vmNodes = data.dataProviders.partitionDataProvider.viewModelCollection.loadedVMObjects;
    // In case of hidden partitions but those are present in the recipe.
    // This partitions needs to consider if user has selected the partitions with search operation.
    if( _transientSelections.length === 0 ) {
        _getAllPartitionsToCacheFromRecipe( subPanelContext );
    }
    return _markSelectedPartitionsFromRecipe( vmNodes, data, subPanelContext );
};

/**
 * This function will Load the tree table properties.
 *
 @param {PropertyLoadRequestArray} propertyLoadInput - An array of PropertyLoadRequest objects this action
 *            function is invoked from. The object is usually the result of processing the 'inputData' property
 *            of a DeclAction based on data from the current DeclViewModel on the $scope) . The 'pageSize'
 *            properties on this object is used (if defined).
 * @returns {Promise} promise
 */
export let loadTreeTableProperties = function( propertyLoadInput ) {
    if( propertyLoadInput ) {
        return exports.loadProperties( propertyLoadInput );
    }

    return AwPromiseService.instance.reject( 'Missing PropertyLoadInput parameter' );
};
/**
 * Loads properties based on the client scope URI.
 * @param {*} propertyLoadInput - An object that contains the requests for what properties to load.
 * @returns{Object} propertyLoadResult property load result
 */
export let loadProperties = function( propertyLoadInput ) {
    var allChildNodes = [];
    // Partition specific column configuration for a user to customize the columns on the filter panel.
    var propertyLoadContext = {
        clientName: 'AWClient',
        clientScopeURI: 'Fgf0PartitionHierarchyCols',
        typesForArrange: [ ]
    };

    _.forEach( propertyLoadInput.propertyLoadRequests, function( propertyLoadRequest ) {
        _.forEach( propertyLoadRequest.childNodes, function( childNode ) {
            if( !childNode.props ) {
                childNode.props = {};
            }
            allChildNodes.push( childNode );
        } );
    } );

    var propertyLoadResult = awTableTreeSvc.createPropertyLoadResult( allChildNodes );

    return tcVmoService.getTableViewModelProperties( allChildNodes, propertyLoadContext ).then(
        function( response ) {
            _.forEach( allChildNodes, function( childNode ) {
                var vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( cdm
                    .getObject( childNode.id ), 'EDIT' );
                _.forEach( vmo.props, function( vmProp ) {
                    childNode.props[ vmProp.propertyName ] = vmProp;
                } );
            } );
            if( response ) {
                propertyLoadResult.columnConfig = response.output.columnConfig;
                //Todo: Remove this hardcoded columns once we have the elements to send in input of gTVMP soa.
                if( propertyLoadResult.columnConfig.columns.length === 0 ) {
                    var columns = [ {
                        associatedTypeName: 'Awb0ConditionalElement',
                        columnOrder: 200,
                        dataType: 'String',
                        displayName: 'Element',
                        pixelWidth: 300,
                        propertyName: 'object_name'
                    } ];
                    propertyLoadResult.columnConfig.columns = columns;
                }
            }

            return {
                propertyLoadResult: propertyLoadResult
            };
        } );
};

/**
 * Update the selection in the cache as per the user's action.
 *
 * @param {Object} selection - Input selections object
 * @param {boolean} isSelected - Is it selected or unselected from the current selection.
 */
let _updateSelectionInFo = function( selection, isSelected ) {
    for( let inx = 0; inx < selection.length; inx++ ) {
        if( isSelected ) {
            // Check if each before selection is present in the current selections
            let partitionInCurrentSelections = _.filter( _transientSelections, function( selected ) {
                return getPartitionUIDFromNode( selected ) === getPartitionUIDFromNode( selection[inx] );
            } );
            if( partitionInCurrentSelections.length === 0 ) {
                _transientSelections.push( selection[inx] );
            }
        }else{
            for( let iny = 0; iny < _transientSelections.length; iny++ ) {
                if( getPartitionUIDFromNode( selection[inx] ) === getPartitionUIDFromNode( _transientSelections[iny] ) ) {
                    _transientSelections.splice( iny, 1 );
                    break;
                }
            }
        }
    }
};

/**
 * When a partition is selected/un-selected, the partition is added to the Newly Selected List or UnSelected list respectively.
 *
 * @param {Object} data - Input data object from the view model
 * @param {Object} subPanelContext - subPanelContext object from the view model
 * @param {Object} eventMap - Data from Event
 * @return {Object} selection in the tree
 * */
export let onPartitionSelection = function( data, subPanelContext, eventMap ) {
    if( eventMap ) {
        let eventData = eventMap[ 'partitionHierarchyTreeTable.gridSelection' ];
        if( !eventData || !eventData.selectedObjects ) {
            return;
        }
        let selection = {
            newlySelectedPartitions: [],
            prevSelectedPartitions: [],
            unSelectedPartitions: []
        };
        let prevSelections = [];
        let curSelections = eventData.selectedObjects;

        if( typeof data.prevSelectedPartitions.length !== 'undefined' ) {
            prevSelections = data.prevSelectedPartitions;
        }
        selection.newlySelectedPartitions = data.newlySelectedPartitions;

        if ( curSelections.length > prevSelections.length ) {
            // Selected new Partition(s) - find all newly selected items
            // Get all entries from selectedObjects that are NOT in prevSelections
            const newlySelectedPartitions = eventData.selectedObjects.filter( selectedItem =>
                !prevSelections.some( prevItem => prevItem === selectedItem )
            );

            // Process each newly selected partition
            for( let inx = 0; inx < newlySelectedPartitions.length; inx++ ) {
                let currentNewPartition = newlySelectedPartitions[inx];

                // First check if the selected partition is in the unSelectedPartitions list ( unselect, select same partition scenario),
                // If present, then remove the partition from the unSelectedPartitions list.
                // If not present, then add the partition to the newlySelectedPartitions list
                let unSelectedPartitions = data.unSelectedPartitions;
                let deletedPartitionsInUnSelectedList = _.remove( unSelectedPartitions, function( unSelectedPartition ) {
                    return unSelectedPartition === currentNewPartition;
                } );

                if ( deletedPartitionsInUnSelectedList && deletedPartitionsInUnSelectedList.length === 0  ) {
                    // Partition not present in unSelectedPartitions list; Add the partition to the newlySelectedPartitions list
                    if ( data.newlySelectedPartitions.length > 0 ) {
                        selection.newlySelectedPartitions.push( currentNewPartition );
                    } else {
                        selection.newlySelectedPartitions = [ currentNewPartition ];
                    }
                }
                _updateSelectionInFo( [ currentNewPartition ], true );
            }

        } else{
            // Unselected a Partition.
            for( let i = 0; i < prevSelections.length; i++ ) {
                // Check if each before selection is present in the current selections
                let partitionInCurrentSelections = _.filter( curSelections, function( curSelection ) {
                    return curSelection === prevSelections[i];
                } );
                if ( partitionInCurrentSelections && partitionInCurrentSelections.length === 0 ) {
                    // Partition is not present in the current selections. That means it is unselected which means...
                    // 1. Partition needs to be removed from newlySelectedPartitions list ( select, unselect a new partition use case) or
                    // 2. Add the partition to the unselected list ( Unselected an existing partition in recipe )
                    if ( data.newlySelectedPartitions.length > 0 ) {
                        let deletedPartitionsInNewlySelectedList = _.remove( data.newlySelectedPartitions, function( newlySelectedPartition ) {
                            return newlySelectedPartition === prevSelections[i];
                        } );
                        if ( deletedPartitionsInNewlySelectedList && deletedPartitionsInNewlySelectedList.length > 0 ) {
                            // Deleted the partition from the New List; hence come out of the loop.
                            _updateSelectionInFo( deletedPartitionsInNewlySelectedList, false );
                            break;
                        }
                    }

                    // If Partition is not deleted from new list, then add the partition to the unselected list to be removed from recipe.
                    if ( data.unSelectedPartitions.length > 0 ) {
                        selection.unSelectedPartitions = data.unSelectedPartitions;
                        // Check if the partition is already present in the un-selected list before adding to the list
                        let partitionInList = _.filter( data.unSelectedPartitions, function( unSelectedPartition ) {
                            return unSelectedPartition === prevSelections[i];
                        } );
                        if ( partitionInList && partitionInList.length === 0 ) {
                            selection.unSelectedPartitions.push( prevSelections[i] );
                        }
                    } else {
                        selection.unSelectedPartitions = [ prevSelections[i] ];
                    }
                    _updateSelectionInFo( [ prevSelections[i] ], false );
                }
            }
        }
        //Use case: The Apply recipe button should be visible only if user has selected some different partitions as compare to the existing recipe.
        let isSelectionDifferentThanRecipe = _isApplyButtonValidWithCurrentSelection( subPanelContext, _transientSelections );
        // Save current selections as previous selections
        selection.prevSelectedPartitions = curSelections;
        return {
            newlySelectedPartitions: selection.newlySelectedPartitions,
            prevSelectedPartitions:  selection.prevSelectedPartitions,
            unSelectedPartitions:    selection.unSelectedPartitions,
            isFilteringValid:        isSelectionDifferentThanRecipe
        };
    }
};


let _isApplyButtonValidWithCurrentSelection = function( subPanelContext, curSelections ) {
    let isSelectionDifferentThanRecipe = true;
    let productContextInfoUID = subPanelContext.occContext.productContextInfo.uid;
    let viewKey = subPanelContext.occContext.viewKey;
    let currentRecipe = _getExistingRecipe( subPanelContext, productContextInfoUID, viewKey );
    let currentRecipeLength = currentRecipe.length;
    let curSelectionsLength = curSelections.length;

    //In case selecting and deselecting the same partition when there is no recipe applied.
    if( currentRecipeLength === 0 && curSelectionsLength === 0 ) {
        return false;
    }

    for( let iny = 0; iny < currentRecipeLength; ++iny ) {
        let recipeTerm = currentRecipe[iny];
        //Usecase: If user selects the partition and again deselect the partition then the apply button should
        // be disabled. Similarly if he deselect one partition from the existing recipe and select another Partition,
        // then the Apply should be enable for a user to click on it.
        if ( recipeTerm.criteriaType === _PARTITION && subPanelContext.sharedData.clickedObj.internalName === recipeTerm.criteriaValues[0]
             && recipeTerm.criteriaValues.length - 1 === curSelectionsLength ) {
            for( let inx = 0; inx < curSelectionsLength; ++inx ) {
                var partitionUidInSelection;
                if( curSelections[inx].props && curSelections[inx].props.awb0UnderlyingObject ) {
                    partitionUidInSelection = curSelections[inx].props.awb0UnderlyingObject.dbValue;
                }else{
                    partitionUidInSelection = curSelections[inx].uid;
                }

                if( recipeTerm.criteriaOperatorType === subPanelContext.sharedData.recipeOperator && partitionUidInSelection !== undefined
                    && recipeTerm.criteriaValues.includes( partitionUidInSelection ) ) {
                    isSelectionDifferentThanRecipe = false;
                } else {
                    isSelectionDifferentThanRecipe = true;
                    break;
                }
            }
        }
    }
    return isSelectionDifferentThanRecipe;
};
/**
 * When user search the partition in the search box then convert that result to the map.
 * @param {Object} filter - Filter
 * @param {Object} selectedPartition - All Selected Partitions
 * @return {Object} searchFilter Map
 */
let _createSearchFilterMapForSOA = function( filter, selectedPartition ) {
    var searchFilterMap = {};

    searchFilterMap.count = filter.count;
    searchFilterMap.endDateValue = filter.endDateValue;
    searchFilterMap.endNumericValue = filter.endNumericValue;
    searchFilterMap.hasChildren = false;
    searchFilterMap.searchFilterType = _PARTITION;
    searchFilterMap.selected = true;
    searchFilterMap.startDateValue = filter.startDateValue;
    searchFilterMap.startEndRange = '';
    searchFilterMap.startNumericValue = filter.startNumericValue;
    searchFilterMap.stringDisplayValue = selectedPartition.displayName;
    searchFilterMap.stringValue = filter.stringValue;

    return searchFilterMap;
};

/**
 * This function will create a filter object for the selected partition object.
 *
 * @param {Object} selObject - Partition Object.
 * @return {object} - Filter Object which holds SOA input.
 */
export let getFilterObject = function( selObject ) {
    var filter = {};

    if ( !selObject.id ) {
        filter.stringValue = selObject.uid;
    } else {
        var clientObject = cdm.getObject( selObject.id );
        filter.stringValue = clientObject.props.awb0UnderlyingObject.dbValues[0];
    }
    filter.count = 0;
    filter.endDateValue = '0001-01-01T00:00:00';
    filter.endNumericValue = 0;
    filter.hasChildren = false;
    filter.searchFilterType = _PARTITION;
    filter.selected = true;
    filter.startDateValue = '0001-01-01T00:00:00';
    filter.startEndRange = '';
    filter.stringDisplayValue = selObject.displayName;
    filter.startNumericValue = 0;

    return filter;
};

/**
 * Creates Partition Input filters that need to be set on the context.
 * *
 * @param {Object} selectedObjects - Newly Selected Partitions in the Tree
 * @param {Object} partitionSchemeObject - Partition Scheme for which Popup is opened
 * @returns {Object} Applied filters that need to be set on the context.
 */
export let createPartitionInputFilters = function( selectedObjects, partitionSchemeObject ) {
    var appliedFilters;
    var searchFilterCategories;
    var searchFilterMap;
    var categoryExist = false;

    // For each selected object, get the uid as the filter.stringValue
    for( let i = 0; i < selectedObjects.length; i++ ) {
        let filter = getFilterObject( selectedObjects[i] );

        if( appliedFilters && appliedFilters.filterCategories ) {
            searchFilterCategories = appliedFilters.filterCategories[0];
            if( searchFilterCategories ) {
                categoryExist = true;
                searchFilterMap = appliedFilters.filterMap[searchFilterCategories.internalName];
            }
        }

        if( !categoryExist ) {
            //set the search filter category.
            searchFilterCategories = _createSearchFilterCategoryForSOA( partitionSchemeObject );
        }
        //set the filter values Map for this category.
        var searchFilterMapObj = _createSearchFilterMapForSOA( filter, selectedObjects[i] );

        if( !categoryExist ) {
            if( appliedFilters && appliedFilters.filterCategories ) {
                appliedFilters.filterCategories.push( searchFilterCategories );
                appliedFilters.filterMap[searchFilterCategories.internalName] = [ searchFilterMapObj ];
            } else{
                var filterMap = {};
                filterMap[searchFilterCategories.internalName] = [ searchFilterMapObj ];

                appliedFilters = {
                    filterCategories: [ searchFilterCategories ],
                    filterMap: filterMap
                };
            }
        }else{
            searchFilterMap.push( searchFilterMapObj );
        }
    }
    return appliedFilters;
};

/**
 * This function will create a structure for holding SOA input for given partition scheme.
 *
 * @param {Object} partitionSchemeObject - Partition Scheme for which Popup is opened.
 * @return {object} - Search filter category object which holds SOA input.
 */
var _createSearchFilterCategoryForSOA = function( partitionSchemeObject ) {
    var searchFilterCategory = {};

    searchFilterCategory.categoryType = _PARTITION;
    searchFilterCategory.defaultFilterValueDisplayCount = 5;
    searchFilterCategory.displayName = partitionSchemeObject.displayName;
    searchFilterCategory.editable = true;
    searchFilterCategory.internalName = partitionSchemeObject.internalName;
    searchFilterCategory.isHierarchical = false;
    searchFilterCategory.isMultiSelect = false;
    searchFilterCategory.quickSearchable = false;

    return searchFilterCategory;
};

/**
 * Creates the criteria for partition filter when user click on apply button.
 * *
 * @param {Object} filter - Newly Selected Partitions in the Tree.
 * @param {Object} partitionScheme - Partition Scheme for which Popup is opened.
 * @returns {Object} filter criteria with current selection in the tree.
 */
let _createCriteriaForPartitionFilters = function( filter, partitionScheme ) {
    let criteria = [];
    criteria[0] = partitionScheme.internalName;
    let partitions = filter.filterMap[partitionScheme.internalName];
    for( let i = 0; i < partitions.length; i++ ) {
        criteria.push( partitions[i].stringValue );
    }
    return criteria;
};

/**
 * Creates recipe string to show when filter panel is in the delay mode.
 * *
 * @param {Object} partitions - Newly Selected Partitions in the Tree.
 * @param {Object} partitionScheme - Partition Scheme for which Popup is opened.
 * @returns {Object} Filter criteria with current selection in the tree.
 **/
let _createTransientPartitionDisplayString = function( partitions, partitionScheme ) {
    var displayStr;
    let partitionVMOs = partitions.filterMap[partitionScheme.internalName];
    let operator = '_$CAT_';
    displayStr = partitionScheme.name;
    displayStr = displayStr.concat( operator );

    if( partitionVMOs.length === 1 ) {
        displayStr = displayStr.concat( partitionVMOs[0].stringDisplayValue );
    } else{
        for( let inx = 0; inx < partitionVMOs.length; inx++ ) {
            if( inx !== 0 ) {
                displayStr = displayStr.concat( '^' );
            }
            displayStr = displayStr.concat( partitionVMOs[inx].stringDisplayValue );
        }
    }

    return displayStr;
};

/**
 * Creates recipe string to show when filter panel is in the delay mode.
 * *
 * @param {Object} subPanelContext - subPanel context
 * @param {Object} partitionSchemeObject - Partition Scheme for which Popup is opened.
 **/
export let updateFiltersInRecipe = ( subPanelContext, partitionSchemeObject ) => {
    let selPartitionTreeNodes = _transientSelections;
    let criteriaVal = [];
    let recipeTerm = [];
    let displayString = '';
    let recipeOperator = 'Filter';

    // If selection is none and we are trying to update the recipe it means that we are removing all partitions from existing recipe for a given scheme.
    // Its similar as that of clicking on close button of recipe.
    if( selPartitionTreeNodes.length === 0 ) {
        recipeOperator = 'Clear';
        let productContextInfoUID = subPanelContext.occContext.productContextInfo.uid;
        let viewKey = subPanelContext.occContext.viewKey;
        let recipeTerms = _getExistingRecipe( subPanelContext, productContextInfoUID, viewKey );
        // Loop through the recipe terms to see if scheme is in the recipe.
        // If yes, then its a recipe update operation else its add operation
        for( let inx = 0; inx < recipeTerms.length; inx++ ) {
            if ( recipeTerms[inx].criteriaType === _PARTITION && recipeTerms[inx].criteriaValues[0].match( partitionSchemeObject.internalName ) ) {
                recipeTerm = recipeTerms[inx];
                break;
            }
        }
        displayString = recipeTerm.criteriaDisplayValue;
        criteriaVal = recipeTerm.criteriaValues;
    } else{
        let filter = createPartitionInputFilters( selPartitionTreeNodes, partitionSchemeObject );
        if( subPanelContext.sharedData && subPanelContext.sharedData.recipeOperator ) {
            recipeOperator = subPanelContext.sharedData.recipeOperator;
        }
        criteriaVal = _createCriteriaForPartitionFilters( filter, partitionSchemeObject );
        displayString = _createTransientPartitionDisplayString( filter, partitionSchemeObject );
    }

    let partitionCriteria = {
        criteriaType: _PARTITION,
        criteriaOperatorType: recipeOperator,
        criteriaDisplayValue: displayString,
        criteriaValues: criteriaVal,
        subCriteria: []
    };
    let spatialRecipeIndexToUpdate;
    occmgmtSubsetUtils.updateSharedDataWithRecipeBeforeNavigate( subPanelContext.activeViewSharedData, subPanelContext.sharedData, partitionCriteria, spatialRecipeIndexToUpdate, 'Awb0DiscoveryFilterCommandSubPanel' );
};

/**
 * Method will get called on mount of partition filter panel.
 * *
 * @param {Object} data - data
 * @param {Object} subPanelContext - subpanel context
 * @returns {Object} the selection from the recipe and a boolean to decide the visibility of apply button.
 */
export function initialPartitionSelectionOnPanel( data, subPanelContext ) {
    let isFilterOperatorDifferent = checkPartitionsInRecipe( data, subPanelContext );
    let selectedObjs = data.dataProviders.partitionDataProvider.getSelectedObjects();
    return {
        prevSelectedPartitions :selectedObjs,
        isFilteringValid:isFilterOperatorDifferent
    };
}

/**
 * The panel width will get changed as per the use case.
 * @param {String} popupId dialog ID.
 */
export function changePanelWidth( popupId ) {
    let options = { width : 'DOUBLEWIDE', context : { operation: '' } };
    dialogService.updateDialogDimensions( popupId, options );
}

/**
 * After performFacetSearch SOA, get the flat list for searched partitions.
 * *
 * @param {Object} data - data
 * @param {Object} partitionSchemeObj - partition scheme in which user is performing the search opeation.
 * @returns {Object} A treeResult with a flat list.
 */
export function getPartitionsList( data, partitionSchemeObj ) {
    let treeLoadResult = { };
    var matchedFilters = data.categories.searchFilterMap[ partitionSchemeObj.internalName ];
    var newVMNodes = [];

    _.forEach( matchedFilters, function( filter ) {
        var vmNode = {
            displayName: filter.stringDisplayValue,
            uid: filter.stringValue,
            isLeaf: true,
            levelNdx: 0,
            iconURL: 'assets/image/typePartition48.svg',
            typeIconURL: 'assets/image/typePartition48.svg'
        };

        if( vmNode.uid !== '' ) {
            newVMNodes.push( vmNode );
        }
    } );

    treeLoadResult.parentNode = data.treeLoadResult.parentNode;
    treeLoadResult.childNodes = newVMNodes;
    treeLoadResult.totalChildCount = newVMNodes.length;
    treeLoadResult.searchVMNodes = newVMNodes;

    //Update the data provider with the search results.
    data.dataProviders.partitionDataProvider.viewModelCollection.update( newVMNodes );
    //need to set is it a search or normal load method
    data.dispatch( { path: 'data.state.dbValue', value: 'search' } );

    return {
        treeLoadResult: treeLoadResult
    };
}
/**
 * destructor for the partition filter panel.
 * get the required data before panel get close.
 *
 * @param {Object} data - data
 * @param {Object} subPanelContext - subpanel context
 */
export function destroyPartitionFilterPanel( data, subPanelContext ) {
    //Clear the selection in the memory/cached.
    _transientSelections = [];
    getExpandedPartitionsCSId( data, subPanelContext );
    resizePanelWidthToNormal( subPanelContext.activeViewSharedData.popupOptions.popupId );
}

/**
 * To retain the expansion state and to get the jitter free behavior:
 * Cached the expanded nodes against scheme uid.
 * *
 * @param {Object} data - data
 * @param {Object} subPanelContext - subpanel context
 */
export function getExpandedPartitionsCSId( data, subPanelContext ) {
    //Ignore the loaded VMO when the panel gets close in search mode.
    //User will get the original expansion state from where he search the partitions.
    if( data.state.dbValue !== 'search' ) {
        let schemeUid = subPanelContext.sharedData.clickedObj.internalName;
        let vmc = data.dataProviders.partitionDataProvider.viewModelCollection;
        let loadedVmos = vmc.getLoadedViewModelObjects();

        var expandedNodes = _.filter( loadedVmos, function( node ) {
            return node.isExpanded && !_.isEmpty( node.stableId );
        } );

        let csidChainsOfNodes = _.map( expandedNodes, function( expandedNode ) {
            return expandedNode.stableId;
        } );

        // Partition filter panel doesnt show the top line but to get the correct result in jitter free expansion
        // server expect the to line with a colon. so append it at the top once all expanded ids are cached.
        csidChainsOfNodes.unshift( ':' );
        if( subPanelContext.occContext.openedObjectType === _WORKSETREVISION ) {
            let subsetUid = subPanelContext.occContext.rootElement.uid;
            if( _expandedNodesInWorkset[subsetUid] === undefined ) {
                _expandedNodesInWorkset[subsetUid] = {};
            }
            _expandedNodesInWorkset[subsetUid][schemeUid] = csidChainsOfNodes;
        } else{
            _expandedNodes[schemeUid] = csidChainsOfNodes;
        }
    }
}

/**
 * resize the panel width to the discovery's filter panel width of the partition filter panel.
 * *
 * @param {String} popupId - dialog ID
 */
export let resizePanelWidthToNormal = function( popupId ) {
    let options = { width : 'STANDARD', context: { operation: '' } };
    dialogService.updateDialogDimensions( popupId, options );
};

/**
 * Load the column configuration
 *
 * @param {Object} dataprovider - the data provider
 * @param {Object} data - the data
 */
export let loadColumns = function( dataProvider, data ) {
    var colInfos = [ {
        name: 'object_name',
        typeName: 'Ptn0Design',
        displayName: data.i18n.name,
        maxWidth: 400,
        minWidth: 150,
        width: 250,
        isTreeNavigation : true
    } ];

    dataProvider.columnConfig = {
        columns: colInfos
    };
};

export const updatePartitionPanelState = ( loadedPartition, isFilterButtonEnable, parentState ) => {
    const newParentState = { ...parentState };
    newParentState.loadedPartition = loadedPartition;
    newParentState.isFilterButtonEnable = isFilterButtonEnable !== undefined ? isFilterButtonEnable : parentState.isFilterButtonEnable;
    parentState.update( newParentState );
};

export const updateSelectedPartitionInfo = ( newlySelectedPartitions, partitionSelectionInfo ) => {
    if( partitionSelectionInfo ) {
        const newSelectedPartitionsData = { ...partitionSelectionInfo };
        newSelectedPartitionsData.selectedPartition = newlySelectedPartitions;
        partitionSelectionInfo.update( newSelectedPartitionsData );
    }
};

export default exports = {
    buildTreeBasedOnSoaResponse,
    changePanelWidth,
    checkPartitionsInRecipe,
    createPartitionInputFilters,
    destroyPartitionFilterPanel,
    getExpandedPartitionsCSId,
    getFilterObject,
    getPartitionHierarchy,
    getPartitionUIDFromNode,
    getPartitionsList,
    getParentUid,
    getProductContext,
    initialPartitionSelectionOnPanel,
    loadColumns,
    loadProperties,
    loadTreeTableProperties,
    onPartitionSelection,
    resetResults,
    resizePanelWidthToNormal,
    updateFiltersInRecipe,
    updatePartitionPanelState,
    updateSelectedPartitionInfo
};
