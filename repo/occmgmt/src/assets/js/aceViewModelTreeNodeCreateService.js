// Copyright (c) 2022 Siemens

/**
 * @module js/aceViewModelTreeNodeCreateService
 */
import appCtxSvc from 'js/appCtxService';
import awTableTreeSvc from 'js/splmTablePublishedTreeService';
import cdmSvc from 'soa/kernel/clientDataModel';
import aceObjectToCSIDGeneratorService from 'js/aceObjectToCSIDGeneratorService';
import aceIconService from 'js/aceIconService';
import occmgmtUtils from 'js/occmgmtUtils';
import aceTreeUtils from 'js/aceTreeUtils';
import uwPropertyService from 'js/uwPropertyService';
import _ from 'lodash';

/**
 * ***********************************************************<BR>
 * Define external API<BR>
 * ***********************************************************<BR>
 */
var exports = {};

let treeNodeHandlers = {};
/**
 * @param {ViewModelTreeNode} vmNode Node being created.
 * @param {String} parentUid Parent uid of vm node.
 * @param {treeLoadInput} treeLoadInput treeLoadInput
 */
function _propogateParentInformationToVMNode( vmNode, parentUid, treeLoadInput ) {
    if ( appCtxSvc.ctx.aceActiveContext ) {
        var currentContext = appCtxSvc.getCtx( appCtxSvc.ctx.aceActiveContext.key );
        var vmc = currentContext.vmc;
        if( vmc ) {
            var parentObjNdx = vmc.findViewModelObjectById( parentUid );
            var parentNode = vmc.getViewModelObject( parentObjNdx );
            if( parentNode && parentNode.isGreyedOutElement && !( treeLoadInput && treeLoadInput.isResetRequest ) && !( treeLoadInput && treeLoadInput.filterOrConfigChangeInContext ) ) {
                vmNode.isGreyedOutElement = parentNode.isGreyedOutElement;
            }
        }
    }

    vmNode.parentUid = parentUid;
}

/**
 *
 */
const _updateVMNodesWithIncompleteHeadTailInfo = ( cursorInfo, vmNodes ) => {
    var headChild = _.head( vmNodes );
    var lastChild = _.last( vmNodes );

    if( !cursorInfo.startReached ) {
        headChild.incompleteHead = true;
    }

    if( !cursorInfo.endReached ) {
        lastChild.incompleteTail = true;
    }
};

let _applyVMNodeCreationStrategy = function( vmNode, vmNodeCreationStrategy ) {
    if( _.isUndefined( vmNode ) || _.isUndefined( vmNodeCreationStrategy ) ) {
        return vmNode;
    }

    let reuseVMNode = _.isUndefined( vmNodeCreationStrategy.reuseVMNode ) ? false : vmNodeCreationStrategy.reuseVMNode;
    let staleVMNodeUids = _.isUndefined( vmNodeCreationStrategy.staleVMNodeUids ) ? [] : vmNodeCreationStrategy.staleVMNodeUids;

    if( reuseVMNode && !_.includes( staleVMNodeUids, vmNode.uid ) ) {
        if( vmNodeCreationStrategy.referenceLoadedVMObjectUidsMap.has( vmNode.uid ) ) {
            let loadedVMNode = vmNodeCreationStrategy.referenceLoadedVMObjectUidsMap.get( vmNode.uid );

            delete vmNode.type;
            if( vmNodeCreationStrategy.cloneRootPathObject ) {
                // we should always create new object for root object.
                // the root objects are part of rootPath objects, if we share the same object
                // then it create problem while tree processing.
                // Copy stable id from loaded node instead of stable id generated via awb0CopyStableId
                if( vmNode.stableId ) {
                    vmNode.stableId = loadedVMNode.stableId;
                    vmNode.alternateID = loadedVMNode.alternateID;
                }
                vmNode = _.clone( _.assign( loadedVMNode, vmNode ) );
            } else {
                // we should share the same objects while sharing vmNodes.
                // else the __expandState VMOs might get out of sync with newly created VMNodes.
                vmNode = _.assign( loadedVMNode, vmNode );
            }
        }

        // clear expansion cache
        if( !_.isUndefined( vmNodeCreationStrategy.clearExpandState ) && vmNodeCreationStrategy.clearExpandState === true && !_.isUndefined( vmNode.__expandState ) ) {
            delete vmNode.__expandState;
        }

        // always re-evaluate isExpanded for view model tree node.
        if( !_.isUndefined( vmNode.isExpanded ) && vmNode.isExpanded === true &&
            ( _.isUndefined( vmNode.children ) || _.isEmpty( vmNode.children ) ) ) {
            delete vmNode.isExpanded;
        }

        // always clear the placeholder state with vmNode if any
        // let next code take care of applying placeholder state.
        if( !_.isUndefined( vmNode.isPlaceholder ) ) {
            delete vmNode.isPlaceholder;
        }

        // we should delete markForDeletion flag as we are here to create vmNode
        if( !_.isUndefined( vmNode.markForDeletion ) ) {
            delete vmNode.markForDeletion;
        }
    }
    return vmNode;
};

/**
 * @param {IModelObject} modelObj - IModelObject Information to base the new node upon.
 * @param {Number} childNdx - child Index
 * @param {Number} levelNdx - Level index
 * @param {String} vmNodeCreationStrategy - Strategy whether to reuse view model node from current view model collection.
 *
 * @return {ViewModelTreeNode} View Model Tree Node
 */
export let createVMNodeUsingModelObjectInfo = function( modelObj, childNdx, levelNdx, vmNodeCreationStrategy, pciUid ) {
    var displayName;

    if( modelObj.props && modelObj.props.object_string ) {
        displayName = modelObj.props.object_string.uiValues[ 0 ];
    } else {
        if( modelObj.toString ) {
            displayName = modelObj.toString();
        }
    }

    var occUid = modelObj.uid;
    var occType = modelObj.type;
    var props = modelObj.props;
    var nChild = props && props.awb0NumberOfChildren ? props.awb0NumberOfChildren.dbValues[ 0 ] : 0;

    if( !displayName ) {
        displayName = occUid;
    }

    var iconURL = aceIconService.getTypeIconURL( modelObj, occType );

    var vmNode = awTableTreeSvc.createViewModelTreeNode( occUid, occType, displayName, levelNdx, childNdx, iconURL, '' );

    vmNode.isLeaf = nChild <= 0;
    /**
     * "stableId" property on occurrence is intended to be used strictly for maintaining expansion state of nodes in
     * Tree views. DO NOT USE IT FOR OTHER PURPOSES.
     */
    if( props && props.awb0Parent && props.awb0CopyStableId ) {
        vmNode.stableId = aceObjectToCSIDGeneratorService.getCloneStableIdChain( modelObj, 'TreeStyleCsidPath' );
        // The following line replaces all instances of "/" in the stableId property with ":" so that it is in sync with the value when sent by server.
        // This is a temporary change and should be rolled back as soon as "aceObjectToCSIDGeneratorService" is changed to use ":" as separator.
        vmNode.stableId = vmNode.stableId.replace( /\//g, ':' );

        if( !_.isUndefined( vmNode.stableId ) && !_.isEmpty( vmNode.stableId ) ) {
            if( vmNode.stableId.length > 1 ) {
                vmNode.alternateID = vmNode.stableId;
            }
        }
    }

    if( props && props.awb0BreadcrumbAncestor ) {
        vmNode.parentUid = props.awb0BreadcrumbAncestor.dbValues[ 0 ];
    }
    _.each( treeNodeHandlers, function( handler ) {
        //passing actual treeLoadInput would need changes in lot of callers.
        //till this date, its going undefined anway. Passing undefined explicitly so that pciUid can be passed.
        if( handler.condition( /*treeLoadInput*/undefined, pciUid ) ) {
            handler.callbackFunction( vmNode );
        }
    } );
    vmNode = _applyVMNodeCreationStrategy( vmNode, vmNodeCreationStrategy );
    return vmNode;
}; // _createVMNodeUsingModelObjectInfo

var isJson = function( str ) {
    try {
        return JSON.parse( str );
    } catch ( e ) {
        return false;
    }
};

/**
 * @param {SoaOccurrenceInfo} occInfo - Occurrence Information returned by server
 * @param {Number} childNdx - child Index
 * @param {Number} levelNdx - Level index
 * @param {String} pciUid - PCI uid of the element which this node is going to represent
 * @param {String} parentUid - Parent uid of vm node
 * @param {String} vmNodeCreationStrategy - Strategy whether to reuse view model node from current view model collection.
 *
 * @return {ViewModelTreeNode} View Model Tree Node
 */
export let createVMNodeUsingOccInfo = function( occInfo, childNdx, levelNdx, pciUid, parentUid, modelObjectType, treeLoadInput, vmNodeCreationStrategy ) {
    var displayName = occInfo.displayName;
    var occUid = occInfo.occurrenceId;
    var occType = occInfo.underlyingObjectType;

    if( modelObjectType === undefined || modelObjectType === null ) {
        modelObjectType = occType;
    }

    // We have multiple defects here- LCS-954844, LCS-929144, LCS-951247
    // nChild is used here to decide if we need to show Chevron
    // occInfo.numberOfChildren is always the latest and greatest information if received, However for delta responses server may not send this information
    // If VM nodes are NOT getting reused use occInfo.numberOfChildren
    // If VM nodes are getting reused we should rely on occInfo.numberOfChildren ONLY IF it is greater than 0 - If not we should fall back on awb0NumberOfChildren from Client Data Model
    let reuseVMNode = false;
    if( !_.isUndefined( vmNodeCreationStrategy ) ) {
        reuseVMNode = _.isUndefined( vmNodeCreationStrategy.reuseVMNode ) ? false : vmNodeCreationStrategy.reuseVMNode;
    }
    var occurrenceObject = cdmSvc.getObject( occUid );
    var props = occurrenceObject && occurrenceObject.props;
    var nChild = reuseVMNode ? occInfo.numberOfChildren > 0 ? occInfo.numberOfChildren :
        props && props.awb0NumberOfChildren ? props.awb0NumberOfChildren.dbValues[ 0 ] : occInfo.numberOfChildren :
        occInfo.numberOfChildren;

    let objectStringVMTNProp = undefined;

    if( !displayName ) {
        if( occInfo.occurrence && occInfo.occurrence.props && occInfo.occurrence.props.object_string ) {
            displayName = occInfo.occurrence.props.object_string.dbValues[0];
        } else {
            displayName = occUid;
        }
    } else {
        let deltaValues = isJson( displayName );

        if( deltaValues !== false  && typeof deltaValues === 'object' ) {
            for( let inx in deltaValues ) {
                if( deltaValues[inx].type === 'Added' ) {
                    displayName = deltaValues[inx].value;
                    break;
                }
            }
            objectStringVMTNProp = uwPropertyService.createViewModelProperty( 'object_string', 'Element', 'STRING', '', [] );
            objectStringVMTNProp.deltaValues = deltaValues;
        }
    }

    var iconURL = aceIconService.getTypeIconURL( occInfo, occType );

    var vmNode = awTableTreeSvc.createViewModelTreeNode( occUid, modelObjectType, displayName, levelNdx, childNdx, iconURL, '' );

    if ( objectStringVMTNProp !== undefined ) {
        vmNode.props = { object_string: objectStringVMTNProp };
        vmNode.fetchRemainingProps = true;
    }

    vmNode.isLeaf = nChild <= 0;
    /**
     * "stableId" property on occurrence is intended to be used strictly for maintaining expansion state of nodes in
     * Tree views. DO NOT USE IT FOR OTHER PURPOSES.
     */
    vmNode.stableId = occInfo.stableId;
    vmNode.pciUid = pciUid;
    let contextKey;
    if( treeLoadInput && treeLoadInput.contextKey ) {
        contextKey = treeLoadInput.contextKey;
    } else if( appCtxSvc.ctx.aceActiveContext ) {
        contextKey = appCtxSvc.ctx.aceActiveContext.key;
    }
    vmNode.contextKey = contextKey;

    // In case of insertLevel the occInfo.stableId is empty for the new occurrences returned as a part of newElementInfos in the SOA response.
    // So, compute it from the occInfo.
    var stableId = vmNode.stableId;
    if( !stableId && occInfo.occurrence && occInfo.occurrence.props && occInfo.occurrence.props.awb0Parent && occInfo.occurrence.props.awb0CopyStableId ) {
        stableId = aceObjectToCSIDGeneratorService.getCloneStableIdChain( occInfo.occurrence, 'TreeStyleCsidPath' );
        stableId = stableId.replace( /\//g, ':' );
    } else if( !stableId && !_.isUndefined( occInfo ) && ( _.isUndefined( occInfo.occurrence ) || _.isUndefined( occInfo.occurrence.props ) ) ) {
        var occurrence = cdmSvc.getObject( occInfo.occurrenceId );
        //getCloneStableIdChain() always expect props
        if( !_.isUndefined( occurrence ) && occurrence !== null && occurrence.props ) {
            stableId = aceObjectToCSIDGeneratorService.getCloneStableIdChain( occurrence, 'TreeStyleCsidPath' );
            stableId = stableId.replace( /\//g, ':' );
        }
    }

    if( !_.isUndefined( stableId ) && !_.isEmpty( stableId ) ) {
        if( stableId.length > 1 ) {
            vmNode.alternateID = stableId;
        }
        if( vmNode.stableId !== stableId ) {
            vmNode.stableId = stableId;
        }
    }

    if( parentUid ) {
        _propogateParentInformationToVMNode( vmNode, parentUid, treeLoadInput );
    }

    _.each( treeNodeHandlers, function( handler ) {
        if( handler.condition( treeLoadInput, pciUid ) ) {
            handler.callbackFunction( vmNode );
        }
    } );
    vmNode = _applyVMNodeCreationStrategy( vmNode, vmNodeCreationStrategy );
    return vmNode;
};

export let createVMNodesForGivenOccurrences = function( childOccInfos, levelNdx, pciUid, elementToPciMap, parentUid, treeLoadInput, vmNodeCreationStrategy ) {
    var vmNodes = [];

    for( var childNdx = 0; childNdx < childOccInfos.length; childNdx++ ) {
        var elementPciUid = pciUid;

        if( elementToPciMap && elementToPciMap[ childOccInfos[ childNdx ].occurrenceId ] ) {
            elementPciUid = elementToPciMap[ childOccInfos[ childNdx ].occurrenceId ];
        }

        var modelObject = cdmSvc.getObject( childOccInfos[ childNdx ].occurrenceId );
        var modelObjectType = null;
        if( modelObject ) {
            modelObjectType = modelObject.type;
        }
        var vmNode = exports.createVMNodeUsingOccInfo( childOccInfos[ childNdx ], childNdx, levelNdx, elementPciUid, parentUid, modelObjectType, treeLoadInput, vmNodeCreationStrategy );
        vmNodes.push( vmNode );
    }

    return vmNodes;
};

export let registerTreeNodeHandler = ( handler ) => {
    treeNodeHandlers[ handler.key ] = handler;
    return treeNodeHandlers[ handler.key ];
};

export let unRegisterTreeNodeHandler = ( handler ) => {
    return delete treeNodeHandlers[ handler.key ];
};

export let populateViewModelTreesNodesInTreeHierarchyFormat = function( treeLoadOutput, response, treeLoadInput ) {
    var vmNodesInTreeHierarchyLevels = [];
    var levelNdx = -1;
    var vmNodes = [];
    var rootPathNodesLength = treeLoadOutput.rootPathNodes.length - response.parentChildrenInfos.length + 1;

    //Build levels of placeholder parents
    for( var ndx = 0; ndx < rootPathNodesLength; ndx++, levelNdx++ ) {
        vmNodesInTreeHierarchyLevels.push( [ treeLoadOutput.rootPathNodes[ ndx ] ] );
    }
    if( levelNdx > -1 ) {
    //Parent level from which occurrences have been returned
        var startLevelNdx = levelNdx;
        _.forEach( response.parentChildrenInfos, function( parentChildInfo ) {
            vmNodes = createVMNodesForGivenOccurrences( parentChildInfo.childrenInfo, levelNdx, treeLoadOutput.currentState.pci_uid, treeLoadOutput.elementToPCIMap,
                parentChildInfo.parentInfo.occurrenceId, treeLoadInput, treeLoadOutput.vmNodeCreationStrategy );
            //If level is incomplete (head/tail), update VM Nodes with that info
            _updateVMNodesWithIncompleteHeadTailInfo( parentChildInfo.cursor, vmNodes );
            vmNodesInTreeHierarchyLevels.push( vmNodes );
            levelNdx++;
        } );

        //Update cursor information on VM Nodes
        _.forEach( response.parentChildrenInfos, function( parentChildInfo ) {
            var parentViewModelTreeNode = vmNodesInTreeHierarchyLevels[ startLevelNdx ].filter( function( vmo ) {
                return vmo.id === parentChildInfo.parentInfo.occurrenceId;
            } )[ 0 ];
            parentViewModelTreeNode.cursorObject = parentChildInfo.cursor;
            startLevelNdx++;
        } );
    }
    treeLoadOutput.vmNodesInTreeHierarchyLevels = vmNodesInTreeHierarchyLevels;
    return vmNodes;
};

/**
 * populates ViewModelTreeNodes
 * @param {treeLoadInput} TreeLoadInput
 * @param {treeLoadOutput} TreeLoadOutput
 * @param {response} GetOccurrences response
 * @param {declViewModel} decl ViewModel
 * @param {contextState} Context State
 * @returns View Model Tree Nodes
 */
export let populateViewModelTreesNodesInTreeHierarchyFormatForTopDown = ( treeLoadInput, treeLoadOutput, response, declViewModel )=> {
    var vmNodesInTreeHierarchyLevels = treeLoadOutput.vmNodesInTreeHierarchyLevels;
    var dataProvider = occmgmtUtils.getCurrentTreeDataProvider( declViewModel.dataProviders );
    let vmNodes = undefined;
    /*
     *   Populate Parent VM Node
     */
    if( treeLoadOutput.mergeNewNodesInCurrentlyLoadedTree ) {
        var parentNodeIndex = dataProvider.viewModelCollection.findViewModelObjectById( response.parentOccurrence.occurrenceId );

        if( parentNodeIndex !== -1 ) {
            var parentNode = _.assign( {}, dataProvider.viewModelCollection.getViewModelObject( parentNodeIndex ) );
            vmNodesInTreeHierarchyLevels.push( [ parentNode ] );
        }
    } else {
        var placeHolderParentsInRootPathNodes = aceTreeUtils.findPlaceHolderParentsInRootPathNodes( response.parentChildrenInfos, treeLoadOutput.rootPathNodes );

        //topNode to be added in vmNodesInTreeHierarchyLevels here for correct indentation and processing of data.
        if( treeLoadOutput.showTopNode ) {
            vmNodesInTreeHierarchyLevels.push( [ treeLoadOutput.rootPathNodes[ 1 ] ] );
        }

        // Build levels of placeholder parents
        for( var ndx = 1; ndx < placeHolderParentsInRootPathNodes.length; ndx++ ) {
            vmNodesInTreeHierarchyLevels.push( [ treeLoadOutput.rootPathNodes[ ndx ] ] );
        }

        // The parent object in first parentChildrenInfos is the child of the last root path node. So insert it in vmNodesInTreeHierarchyLevels.
        if( placeHolderParentsInRootPathNodes.length > 0 ) {
            var parentModelObject = cdmSvc.getObject( response.parentChildrenInfos[ 0 ].parentInfo.occurrenceId );
            var vmNodeLevelIndex = aceTreeUtils.getVMNodeLevelIndex( treeLoadOutput, response.parentChildrenInfos, parentModelObject );
            // If the parent object Level index is non negative, then only it is part of the tree hierarchy. So, create a placeholder node for it.
            if( vmNodeLevelIndex > -1 ) {
                var firstLoadedParentNode = createVMNodeUsingModelObjectInfo( parentModelObject, 0, vmNodeLevelIndex, treeLoadOutput.vmNodeCreationStrategy );
                firstLoadedParentNode.isPlaceholder = true;
                vmNodesInTreeHierarchyLevels.push( [ firstLoadedParentNode ] );
            }
        }

        // We do not need rootPathNodes for further processing. Retaining those will lead to a different code path and hence we need to get rid of those
        delete treeLoadOutput.rootPathNodes;
    }

    /*
     * Populate VM Node tree hierarchy for all Children
     */
    var uidToLevelMap = new Map();
    var parentNodeOut = _.last( treeLoadOutput.vmNodesInTreeHierarchyLevels );
    if( parentNodeOut ) {
        uidToLevelMap.set( _.last( parentNodeOut ).uid, _.last( parentNodeOut ).$$treeLevel );
    }

    for( ndx = 0; ndx < response.parentChildrenInfos.length; ndx++ ) {
        let parentChildInfo = response.parentChildrenInfos[ ndx ];

        let parentUid = parentChildInfo.parentInfo.occurrenceId;
        let parentLevel = treeLoadOutput.showTopNode ? 0 : -1;

        if( uidToLevelMap.has( parentUid ) ) {
            parentLevel = uidToLevelMap.get( parentUid );
        } else {
            parentLevel = aceTreeUtils.getVMNodeLevelIndexByTraversingParentInCdm( treeLoadOutput.showTopNode, parentUid );
        }

        let childLevel = parentLevel + 1;
        if( parentChildInfo.childrenInfo.length ) {
            for( let childIndex = 0; childIndex < parentChildInfo.childrenInfo.length; ++childIndex ) {
                if( parentChildInfo.childrenInfo[ childIndex ].numberOfChildren > 0 ) {
                    uidToLevelMap.set( parentChildInfo.childrenInfo[ childIndex ].occurrenceId, childLevel );
                }
            }
            //third input parameter should be response.rootProductContext.uid ?. applicable for all getOcc callers? Will update when needed
            vmNodes = createVMNodesForGivenOccurrences( parentChildInfo.childrenInfo, childLevel, treeLoadOutput.currentState.pci_uid, treeLoadOutput.elementToPCIMap,
                parentChildInfo.parentInfo.occurrenceId, treeLoadInput, treeLoadOutput.vmNodeCreationStrategy );
            _updateVMNodesWithIncompleteHeadTailInfo( parentChildInfo.cursor, vmNodes );
            vmNodesInTreeHierarchyLevels.push( vmNodes );
            vmNodeLevelIndex = childLevel;
        }
    }

    treeLoadOutput.vmNodesInTreeHierarchyLevels = vmNodesInTreeHierarchyLevels;

    if( vmNodeLevelIndex === 0 ) {
        delete treeLoadOutput.vmNodesInTreeHierarchyLevels;
        delete treeLoadOutput.nonRootPathHierarchicalData;
    }

    return vmNodes;
};

export default exports = {
    createVMNodeUsingModelObjectInfo,
    createVMNodeUsingOccInfo,
    createVMNodesForGivenOccurrences,
    populateViewModelTreesNodesInTreeHierarchyFormat,
    populateViewModelTreesNodesInTreeHierarchyFormatForTopDown,
    registerTreeNodeHandler,
    unRegisterTreeNodeHandler
};
