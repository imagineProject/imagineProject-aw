// Copyright (c) 2024 Siemens

import cdmSvc from 'soa/kernel/clientDataModel';
import occmgmtUtils from 'js/occmgmtUtils';
import occmgmtVMTNodeCreateService from 'js/aceViewModelTreeNodeCreateService';
import _ from 'lodash';

var exports = {};

/**
 * Function
 *
 * @param {*} parentModelObj parentOccurrence of getOccurrences response
 * @returns{*} rootPath Hierarchy for given parentModelObj
 */
const _buildRootPathObjects = ( parentModelObj ) => {
    /**
     * Determine the path to the 'root' occurrence IModelObject starting at the immediate 'parent' (t_uid)
     * object.
     */
    var rootPathObjects = [];
    var pathModelObject = parentModelObj;

    if( pathModelObject ) {
        var pathParentUid = occmgmtUtils.getParentUid( pathModelObject );
        rootPathObjects.push( pathModelObject );

        while( pathModelObject && pathParentUid ) {
            pathModelObject = cdmSvc.getObject( pathParentUid );

            if( pathModelObject ) {
                rootPathObjects.push( pathModelObject );
                pathParentUid = occmgmtUtils.getParentUid( pathModelObject );
            }
        }
    }

    return rootPathObjects;
};

function _getOccurrenceId( response, occurrenceId ) {
    if( _.isUndefined( occurrenceId ) ) {
        let parentOccurrence = response.parentOccurrence;
        if( !_.isEmpty( parentOccurrence.occurrenceId ) ) {
            return parentOccurrence.occurrenceId;
        }

        let parentChildrenInfo = response.parentChildrenInfos[ 0 ];
        if( parentChildrenInfo && !_.isEmpty( parentChildrenInfo.parentInfo ) ) {
            return parentChildrenInfo.parentInfo.occurrenceId;
        }
    }
    return occurrenceId;
}

function _isRootPathNodePlaceholder( rootPathNode, response, viewModelCollection ) {
    let parentChildrenInfos = response.parentChildrenInfos;

    if ( parentChildrenInfos === undefined ) {
        return false;
    }

    for( var i = 0; i < response.parentChildrenInfos.length; i++ ) {
        var parentChildrenInfo = response.parentChildrenInfos[ i ];

        if( parentChildrenInfo && parentChildrenInfo.parentInfo && parentChildrenInfo.childrenInfo && _.isEqual( parentChildrenInfo.parentInfo.occurrenceId, rootPathNode.uid ) ) {
            return false;
        }

        if( rootPathNode.levelNdx === -1 ) {
            return false;
        }
    }

    var rootPathNodeParentNdx = viewModelCollection.findViewModelObjectById( rootPathNode.uid );
    if( rootPathNodeParentNdx !== -1 ) {
        var rootPathNodeParent = viewModelCollection.getViewModelObject( rootPathNodeParentNdx );
        if( rootPathNodeParent && rootPathNodeParent.children ) {
            return false;
        }
    }
    return true;
}

var getParentVMNodeInfo = function( parentChildrenInfos, node ) {
    var parentInfo = null;

    for( var parentChildIdx = 0; parentChildIdx < parentChildrenInfos.length; parentChildIdx++ ) {
        for( var childrenIdx = 0; childrenIdx < parentChildrenInfos[ parentChildIdx ].childrenInfo.length; childrenIdx++ ) {
            if( node.uid === parentChildrenInfos[ parentChildIdx ].childrenInfo[ childrenIdx ].occurrenceId ||
                node.occurrenceId === parentChildrenInfos[ parentChildIdx ].childrenInfo[ childrenIdx ].occurrenceId ) {
                parentInfo = parentChildrenInfos[ parentChildIdx ].parentInfo;
                break;
            }
        }
    }

    return parentInfo;
};


var _updateVmNodeCreationStrategyForRootPathNodes = function( vmNodeCreationStrategy, response, rootPathObjects, supportedFeatures ) {
    if( _.isUndefined( vmNodeCreationStrategy ) || _.isUndefined( response ) ||
        _.isUndefined( rootPathObjects ) || _.isEmpty( rootPathObjects ) ||
        response.requestPref && response.requestPref.deltaTreeResponse ) {
        return;
    }
    // Disable reuse of VMOs for following cases
    // - Viewing 4G structures
    // - No BOM window reuse
    // - In Session, Workset and Saved Working Context
    let preventReuseOfVmNodes = supportedFeatures && supportedFeatures[ '4GStructureFeature' ] ||
        !_.isUndefined( response.requestPref.windowNotReused ) && response.requestPref.windowNotReused[ 0 ] === 'true' ||
        response.requestPref.openedObjectType && ( response.requestPref.openedObjectType[ 0 ] === 'AppSession' ||
            response.requestPref.openedObjectType[ 0 ] === 'AppSessionWorkset' ||
            response.requestPref.openedObjectType[ 0 ] === 'WorksetRevision' ||
            response.requestPref.openedObjectType[ 0 ] === 'SaveWorkingContext' );
    if( preventReuseOfVmNodes ) {
        vmNodeCreationStrategy.reuseVMNode = false;
    }
};

/**
 * Function
 *
 * @param {*} response getOccurrences response
 * @param {*} rootPathObjects rootPathObjects
 * @param {*} pciUid ProductContextInfo UID
 * @param {*} treeLoadOutput treeLoadOutput structure
 * @returns{*} rootPath Hierarchy for given rootPathObjects
 */
const _buildRootPath = ( occContext, response, rootPathObjects, pciUid, treeLoadOutput ) => {
    /**
     * Determine the path to the 'root' occurrence IModelObject starting at the immediate 'parent' (t_uid)
     * object.
     */
    var rootPathNodes = [];
    let vmc = occContext.vmc ? occContext.vmc : treeLoadOutput.vmc;

    /**
     * Determine new 'top' node by walking back from bottom-to-top of the rootPathObjects and creating nodes to
     * wrap them.
     */
    var nextLevelNdx = -1;
    _updateVmNodeCreationStrategyForRootPathNodes( treeLoadOutput.vmNodeCreationStrategy, response, rootPathObjects, treeLoadOutput.supportedFeatures );
    for( var ndx = rootPathObjects.length - 1; ndx >= 0; ndx-- ) {
        let vmNodeCreationStrategy;
        if( treeLoadOutput.vmNodeCreationStrategy ) {
            vmNodeCreationStrategy = _.clone( treeLoadOutput.vmNodeCreationStrategy );
            vmNodeCreationStrategy.cloneRootPathObject = true;
        }
        var currNode = occmgmtVMTNodeCreateService.createVMNodeUsingModelObjectInfo( rootPathObjects[ ndx ], 0, nextLevelNdx++, vmNodeCreationStrategy, pciUid );

        if( _isRootPathNodePlaceholder( currNode, response, vmc ) ) {
            currNode.isPlaceholder = true;
        }
        /**
         * Note: We mark all necessary 'parent' path nodes as 'placeholders' so that we can find them later and
         * fill them out as needed (when they come into view)
         */
        currNode.isExpanded = true;

        //TopNode for empty structure. Should not be set as expanded. it makes getOcc call otherwise
        if( !_.isEmpty( treeLoadOutput.topNodeOccurrence ) ) {
            currNode.isExpanded = false;
        }

        if( ndx === 0 && response.cursor ) {
            currNode.cursorObject = response.cursor;
        }

        //If we have elementToPCIMap populated,
        //we can take pci corresponding to the currNode.uid's entry
        if( treeLoadOutput.elementToPCIMap ) {
            if( treeLoadOutput.elementToPCIMap[ currNode.uid ] ) {
                pciUid = treeLoadOutput.elementToPCIMap[ currNode.uid ];
            }
        }

        currNode.pciUid = pciUid;

        rootPathNodes.push( currNode );
    }

    return rootPathNodes;
};

/**
 * @internal
 */
export let buildRootPathNodes = ( occContext, treeLoadOutput, response, occurrenceId )=> {
    occurrenceId = _getOccurrenceId( response, occurrenceId );
    if( cdmSvc.isValidObjectUid( occurrenceId ) ) {
        var parentOccurrenceObject = cdmSvc.getObject( occurrenceId );
        var rootPathObjects = _buildRootPathObjects( parentOccurrenceObject );
        var addExtraTopNodeInRootPathHierarchy = treeLoadOutput.showTopNode && _.isEmpty( treeLoadOutput.topNodeOccurrence );

        if( addExtraTopNodeInRootPathHierarchy === true ) {
            var topNode = _.last( rootPathObjects );
            rootPathObjects.push( topNode );
        }

        var rootPathNodes = _buildRootPath( occContext, response, rootPathObjects, treeLoadOutput?.productContextInfo?.uid, treeLoadOutput );

        if( rootPathNodes.length > 0 ) {
            treeLoadOutput.rootPathNodes = rootPathNodes;
        }

        return rootPathNodes;
    }
};

/**
 * @internal
 *
 * @param {*} treeLoadInput treeLoadInput structure
 * @param {*} treeLoadOutput treeLoadOput structure used to treeLoadResult
 */
export let updateNewTopNodeRelatedInformation = ( treeLoadInput, treeLoadOutput ) => {
    if( treeLoadOutput.rootPathNodes && treeLoadOutput.rootPathNodes.length > 0 ) {
        var firstNode = _.first( treeLoadOutput.rootPathNodes );

        treeLoadOutput.newTopNode = firstNode;

        if( firstNode.uid !== treeLoadInput.parentNode.uid || treeLoadOutput.deltaTreeResponse ) {
            treeLoadOutput.topModelObject = cdmSvc.getObject( firstNode.uid );
            treeLoadOutput.baseModelObject = cdmSvc.getObject( firstNode.uid );
        }
    }
};

/**
 * @internal
 */
export let getVMNodeLevelIndexByTraversingParentInCdm = ( showTopNode, uid ) => {
    /*
     *startLevelNdx -1 makes sure that first level is shown at 0th levelNdx. But in case of topNode display,
      topNode gets added at 0th level. So, startLevelNdx should be 0 in that case.
     */
    var startLevelNdx = showTopNode ? 0 : -1;
    while( uid ) {
        var parentUid = occmgmtUtils.getParentUid( cdmSvc.getObject( uid ) );

        if( parentUid ) {
            startLevelNdx++;
        }

        uid = parentUid;
    }

    return startLevelNdx;
};

/**
 * @internal
 */
export let findPlaceHolderParentsInRootPathNodes = ( parentChildrenInfos, rootPathNodes )=> {
    var allParents = _.map( parentChildrenInfos, function( parentChildrenInfo ) {
        return parentChildrenInfo.parentInfo.occurrenceId;
    } );

    return _.filter( rootPathNodes, function( rootPathNode ) {
        return allParents.indexOf( rootPathNode.id ) === -1;
    } );
};

/**
 * @internal
 * Return Level Index of VM node based on its position in Parent Children Map and CDM cache.
 */
export let getVMNodeLevelIndex = ( treeLoadOutput, parentChildrenInfos, node )=> {
    /*
     *startLevelNdx -1 makes sure that first level is shown at 0th levelNdx. But in case of topNode display,
      topNode gets added at 0th level. So, startLevelNdx should be 0 in that case.
     */
    var startLevelNdx = treeLoadOutput.showTopNode ? 0 : -1;
    if( node ) {
        var parentNode = node;
        while( parentNode ) {
            parentNode = getParentVMNodeInfo( parentChildrenInfos, parentNode );
            if( parentNode ) {
                node = parentNode;
                startLevelNdx++;
            }
        }

        while( node.uid || node.occurrenceId ) {
            var parentUid = occmgmtUtils.getParentUid( cdmSvc.getObject( node.uid ? node.uid : node.occurrenceId ) );

            if( parentUid ) {
                startLevelNdx++;
            }

            node = {
                uid: parentUid,
                occurrenceId: parentUid

            };
        }
    }

    return startLevelNdx;
};

export default exports = {
    buildRootPathNodes,
    updateNewTopNodeRelatedInformation,
    getVMNodeLevelIndexByTraversingParentInCdm,
    findPlaceHolderParentsInRootPathNodes,
    getVMNodeLevelIndex
};
