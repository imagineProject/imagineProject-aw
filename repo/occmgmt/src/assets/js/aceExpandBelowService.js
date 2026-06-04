// Copyright (c) 2022 Siemens

/**
 * @module js/aceExpandBelowService
 */
import appCtxService from 'js/appCtxService';
import aceTreeTableExtService from 'js/aceTreeTableExtService';
import awTableStateService from 'js/awTableStateService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import aceUpdatePwaDisplayService from 'js/aceUpdatePwaDisplayService';
import occmgmtUtils from 'js/occmgmtUtils';
import declpopupService from 'js/declpopupService';
import expandRequests from 'js/invoker/expandRequests';

var _awTableToggleRowEvetSubscription = null;
var exports = {};

var getVMOToWorkUpon = function( commandContext ) {
    var selectedUid = commandContext.occContext.pwaSelection[ 0 ].uid;
    var vmc = commandContext.occContext.vmc;
    var vmoId = vmc.findViewModelObjectById( selectedUid );

    if( vmoId !== -1 ) {
        var loadedVMObjects = vmc.getLoadedViewModelObjects();
        return loadedVMObjects[ vmoId ];
    }
    return null;
};

export let performExpandToLevel = function( expansionCriteria, commandContext ) {
    let vmo = getVMOToWorkUpon( commandContext );
    var vmoId = commandContext.occContext.vmc.findViewModelObjectById( vmo.uid );
    let loadedVMOs = commandContext.occContext.vmc.getLoadedViewModelObjects();
    let needVMOUpdate = false;
    let nodesToMarkCollapsed = [];
    let indexesOfNodeToCollapse = [];

    eventBus.publish( commandContext.occContext.vmc.name + '.resetState' );

    if( parseInt( expansionCriteria.expansionLevel ) > 0 ) {
        expansionCriteria.levelsToExpand = expansionCriteria.expansionLevel.toString();
        expansionCriteria.levelsApplicableForExpansion = vmo.$$treeLevel + parseInt( expansionCriteria.levelsToExpand );

        //Start from point in array next to vmo to expand to level upon
        for( let indx = vmoId + 1; indx < loadedVMOs.length; indx++ ) {
            /*break at point where we get vmo with same level...
            that means we have covered all vmos under vmo to expand to level upon
            */
            if( loadedVMOs[ indx ].levelNdx === vmo.levelNdx ) {
                break;
            }
            if( loadedVMOs[ indx ].isExpanded === true  ) {
                nodesToMarkCollapsed.push( loadedVMOs[ indx ] );
                indexesOfNodeToCollapse.push( indx );
                needVMOUpdate = true;
            }
        }

        for( var ndx = indexesOfNodeToCollapse.length - 1; ndx >= 0; ndx-- ) {
            let indx = indexesOfNodeToCollapse[ndx];
            aceUpdatePwaDisplayService.purgeExpandedNode( loadedVMOs[ indx ], loadedVMOs );
        }

        if( needVMOUpdate ) {
            commandContext.occContext.vmc.update( loadedVMOs );
        }

        performExpandBelow( expansionCriteria, commandContext, nodesToMarkCollapsed );
    }
};

export let performExpandBelow = function( expansionCriteria, commandContext, nodesToMarkCollapsed ) {
    let vmo = getVMOToWorkUpon( commandContext );
    let loadedVMOs = commandContext.occContext.vmc.getLoadedViewModelObjects();
    let nodesToExpandPresentForExpandBelow = [];
    let expandToLevel = expansionCriteria.levelsApplicableForExpansion ? expansionCriteria.levelsApplicableForExpansion : -1;
    if( !_.isUndefined( appCtxService.ctx.preferences ) && !_.isUndefined( appCtxService.ctx.preferences.AWB_ExpandBelowResponsePageSize  )
         && appCtxService.ctx.preferences.AWB_ExpandBelowResponsePageSize.length > 0  ) {
        expansionCriteria.loadTreeHierarchyThreshold = appCtxService.ctx.preferences.AWB_ExpandBelowResponsePageSize[0];
    }

    if( vmo ) {
        let parentNodesToExpandUsingCache = [];

        //For vmo to expand below, see if it /its children has collapse cache.
        populateParentNodesToExpandUsingExpandState( loadedVMOs, vmo, parentNodesToExpandUsingCache, nodesToExpandPresentForExpandBelow, commandContext, expandToLevel );

        //For parent nodes that have collapse cache, pre-expand those nodes ( )
        if( parentNodesToExpandUsingCache.length ) {
            for( var ndx = 0; ndx < parentNodesToExpandUsingCache.length; ndx++ ) {
                var parentNode = parentNodesToExpandUsingCache[ ndx ];

                for( var nodeToInsertIndex = 0; nodeToInsertIndex < loadedVMOs.length; nodeToInsertIndex++ ) {
                    if( loadedVMOs[ nodeToInsertIndex ].uid === parentNodesToExpandUsingCache[ ndx ].uid ) {
                        nodeToInsertIndex += 1; //index of first child would be parentNdx + 1
                        break;
                    }
                }

                let childrenToAdd = parentNode.__expandState ? parentNode.__expandState.children : parentNode.children;

                _.forEach( childrenToAdd, function( childVMO ) {
                    //if VMO state is expanded, it will get set while adding its children.
                    //While adding node, we should delete it because for Expand Level case,
                    //if children dont get added, node is shown as expanded with no children under it.
                    if( expandToLevel === childVMO.levelNdx ) {
                        delete childVMO.isExpanded;
                        delete childVMO.expanded;
                    }

                    loadedVMOs.splice( nodeToInsertIndex, 0, childVMO );
                    nodeToInsertIndex++;
                } );

                if( parentNode.__expandState ) {
                    parentNode.expanded = true;
                    parentNode.isExpanded = true;
                    parentNode.isLeaf = false;
                    if( !parentNode.children ) {
                        parentNode.children = [];
                    }
                    parentNode.children = parentNode.__expandState.children;
                    parentNode.startChildNdx = parentNode.__expandState.startChildNdx;
                    parentNode.totalChildCount = parentNode.__expandState.totalChildCount;
                    parentNode.cursorObject = parentNode.__expandState.cursorObject;

                    delete parentNode.__expandState;
                }
            }

            commandContext.occContext.vmc.update( loadedVMOs );
        }
    }

    //trigger atomic data update that would trigger expand below for VMO under action only if there are nodesToExpandPresentForExpandBelow
    if( nodesToExpandPresentForExpandBelow.length ) {
        // Background Expand below is supported when below condition is satisfied
        //    Top node displayed in tree OR Context is AppSession / AppSessionWorkset / ConfigBaseline
        if( expandRequests.expandBelowEnabled( ) && expandToLevel === -1 &&
            ( commandContext.occContext.showTopNode === true ||
              commandContext.occContext.openedObjectType === 'AppSession' ||
              commandContext.occContext.openedObjectType === 'AppSessionWorkset' ||
              commandContext.occContext.openedObjectType === 'ConfigBaseline' ) ) {
            let getPropertiesCallBack = [];
            _.each( aceTreeTableExtService.getTreeDataProviders(), function( provider ) {
                if( provider.condition( commandContext.occContext ) ) {
                    getPropertiesCallBack.push( provider.getProperties );
                }
            } );
            // Run expand below calls using the Structure Invoker
            expandRequests.expandBelow( vmo, commandContext, expansionCriteria, getPropertiesCallBack );
            eventBus.publish( commandContext.provider.gridId + '.expandBelowTreeNode', vmo );
        }else {
            expansionCriteria.nodesToExpandPresentForExpandBelow = nodesToExpandPresentForExpandBelow > 1;
            let value = { ...commandContext.occContext.value };
            value.transientRequestPref = expansionCriteria;
            if( !value.persistentRequestPref ) {
                value.persistentRequestPref = {};
            }
            value.persistentRequestPref.scopeForExpandBelow = vmo.id;
            occmgmtUtils.updateValueOnCtxOrState( '', value, commandContext.occContext );
        }
    } else {
        let value = {
            nodesToMarkCollapsed: nodesToMarkCollapsed,
            updateTreeNodeStates: true
        };
        occmgmtUtils.updateValueOnCtxOrState( 'transientRequestPref', value, commandContext.occContext );
    }

    declpopupService.close( 'allPopups' );
};

let populateParentNodesToExpandUsingExpandState = function( loadedVMOs, vmo, parentNodesToExpandUsingCache, nodesToExpandPresentForExpandBelow, commandContext, expandToLevel ) {
    let vmoId = commandContext.occContext.vmc.findViewModelObjectById( vmo.uid );
    let addNodeForExpansionStateChange = function( vmo ) {
        if( expandToLevel === -1 || vmo.levelNdx < expandToLevel ) {
            parentNodesToExpandUsingCache.push( vmo );
        }
    };
    let hasChildren = vmo.children && vmo.children.length > 0;
    //1) If vmo has expansionState ( collapse on vmo case or collapse below on grandparent) or
    if( !_.isEmpty( vmo.__expandState ) ) { // vmo has expansion state ( collapsed , can be candidate for expansion)
        addNodeForExpansionStateChange( vmo );
    } else if( hasChildren && vmoId === -1 ) { //vmo not currently loaded & has children ( collapse grand parent case )
        addNodeForExpansionStateChange( vmo );
    } else if( vmo.isLeaf === false && vmo.isExpanded !== true && hasChildren ) {
        addNodeForExpansionStateChange( vmo );
        nodesToExpandPresentForExpandBelow.push( vmo.id );
    } else if( vmo.isLeaf === false && vmo.isExpanded !== true ) {
        nodesToExpandPresentForExpandBelow.push( vmo.id );
    }

    let vmoChildren = vmo.__expandState ? vmo.__expandState.children : vmo.children;

    _.forEach( vmoChildren, function( vmoChild ) {
        vmoId = commandContext.occContext.vmc.findViewModelObjectById( vmoChild.uid );
        let childToExpand = loadedVMOs[vmoId] !== undefined ? loadedVMOs[vmoId] : vmoChild;

        if( childToExpand.__expandState || childToExpand.children ) {
            populateParentNodesToExpandUsingExpandState( loadedVMOs, childToExpand, parentNodesToExpandUsingCache, nodesToExpandPresentForExpandBelow, commandContext, expandToLevel  );
        } else {
            if( childToExpand.isLeaf === false && childToExpand.isExpanded !== true ) {
                nodesToExpandPresentForExpandBelow.push( childToExpand.id );
            }
        }
    } );

    return nodesToExpandPresentForExpandBelow;
};

export let performCollapseBelow = function( commandContext ) {
    var dataProviderId = commandContext.occContext.vmc.name;
    var vmo = getVMOToWorkUpon( commandContext );

    declpopupService.close( 'allPopups' );

    if( vmo && vmo.isExpanded === true ) {
        eventBus.publish( dataProviderId + '.toggleTreeNodeHierarchy', vmo );
    }
};

var initializeEventSubscriptions = function() {
    if( !_awTableToggleRowEvetSubscription ) {
        _awTableToggleRowEvetSubscription = eventBus.subscribe( 'toggleTreeNodeHierarchy', exports.collapseNodeHierarchy );
    }
};

export let collapseNodeHierarchy = function( eventData ) {
    var gridId = Object.keys( eventData.data.grids )[ 0 ];
    var declGrid = eventData.data._internal.grids[ gridId ];
    var uwDataProvider = eventData.data.dataProviders[ declGrid.dataProvider ];
    var loadedVMOs = uwDataProvider.viewModelCollection.getLoadedViewModelObjects();
    var vmoId = uwDataProvider.viewModelCollection.findViewModelObjectById( eventData.row.uid );
    var vmo = loadedVMOs[ vmoId ];
    // LCS-281388. workaround till the time children get populted on top node after use cases like sort or filter.
    if( vmo && vmo.children ) {
        var data = eventData.data;
        var purgeInputParams = {
            markExpansionsInHierarchyCollapsed: true,
            nodesToBeSavedAsCollapsed: [],
            data: data,
            gridId: gridId,
            providerName: uwDataProvider.name
        };

        for( var ndx = 0; ndx < vmo.children.length; ndx++ ) {
            var immediateChild = vmo.children[ ndx ];
            if( immediateChild.isExpanded ) {
                aceUpdatePwaDisplayService.purgeExpandedNode( immediateChild, loadedVMOs, purgeInputParams );
            }

            //Nodes in expand below mode dont have isExpanded marked as true. But they go in expansion state
            //so that once they are visible on , they get programatically expanded in expand below mode.
            if( immediateChild.isInExpandBelowMode ) {
                delete immediateChild.isInExpandBelowMode;
                awTableStateService.saveRowCollapsed( data, gridId, immediateChild );
            }
        }

        vmo.isInExpandBelowMode = false;

        aceUpdatePwaDisplayService.purgeExpandedNode( vmo, loadedVMOs, purgeInputParams );
        uwDataProvider.update( loadedVMOs );
    }
};

export let initialize = function() {
    initializeEventSubscriptions();
};

export let destroy = function() {
    if( _awTableToggleRowEvetSubscription ) {
        eventBus.unsubscribe( _awTableToggleRowEvetSubscription );
        _awTableToggleRowEvetSubscription = null;
    }
};

export default exports = {
    performExpandBelow,
    performCollapseBelow,
    performExpandToLevel,
    collapseNodeHierarchy,
    destroy,
    initialize
};

