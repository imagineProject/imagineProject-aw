/**
 * @module js/tableConfigsPwaService
 */
import soaSvc from 'soa/kernel/soaService';
import iconSvc from 'js/iconService';
import awTableService from 'js/splmTablePublishedTreeService';
import uwPropertySvc from 'js/uwPropertyService';
import notySvc from 'js/NotyModule';
import localeService from 'js/localeService';
import messageService from 'js/messagingService';
import awPromiseSvc from 'js/awPromiseService';
import awStateService from 'js/awStateService';
import _ from 'lodash';

const icons = {
    Fnd0ClientScope: iconSvc.getTypeIconFileUrl( 'typeTableProperty48.svg' ),
    Awp0Workspace: iconSvc.getTypeIconFileUrl( 'typeWorkspace48.svg' ),
    Group: iconSvc.getTypeIconFileUrl( 'typeGroup48.svg' ),
    Role: iconSvc.getTypeIconFileUrl( 'typeRole48.svg' ),
    Site: iconSvc.getTypeIconFileUrl( 'typeSiteLocation48.svg' ),
    TableConfiguration: iconSvc.getTypeIconFileUrl( 'typeTableConfiguration48.svg' )
};

const tableConfigsSoaServiceName = 'Internal-AWS2-2024-12-UiConfig';

/**
 * @typedef {Object} tableConfigsSoaResponse
 * @property {String} parentTableConfigId parent table configuration id
 * @property {String} tableConfigId table configuration id
 * @property {Array<tableConfigSoaProps>} tableConfigProperties table configuration properties
 */

/**
 * @typedef {Object} tableConfigSoaProps
 * @property {String} propertyName property name
 * @property {Array<String>} displayValues display values
 * @property {Array<String>} internalValues internal values
 */

let fakeTreeLoadInput = {
    parentNode: {
        $$treeLevel: -1,
        childNdx: 0,
        displayName: 'top',
        iconURL: null,
        id: 'top',
        levelNdx: -1,
        svgString: undefined,
        type: 'unknown',
        uid: 'top',
        visible: true
    },
    startChildNdx: 0
};

/**
 * Calls SOA to get table configurations and returns the response array
 *
 * @param {TreeLoadInput} treeLoadInput input object for tree load containing parent node information
 * @param {Array<SortCriteriaConfiguration>} sortCriteria sort criteria to get sort direction for soa input
 * @param {searchState} searchState search state to create column filter for name column for soa input
 * @param {String} focusColumnConfigId column configuration id to send to
 * @param {String} focusTableConfigId table configuration id to focus
 * @returns {Promise<Array<tableConfigsSoaResponse>>} array of table configurations from getTableConfigurations SOA
 */
async function getTableConfigsData( treeLoadInput, sortCriteria, searchState, focusColumnConfigId, focusTableConfigId ) {
    let soaInput = {
        searchOptions: {
            tableConfigId: treeLoadInput.parentNode.uid
        },
        columnFilters: []
    };
    if ( sortCriteria?.length > 0 ) {
        soaInput.searchOptions.sortDirection = sortCriteria[0].sortDirection;
    }
    let searchString = searchState?.criteria.searchString;
    if ( searchString ) {
        let cFilter = {
            columnName: 'name',
            operation: 'contains',
            values: [ searchString ]
        };
        soaInput.columnFilters.push( cFilter );
    }

    if ( focusColumnConfigId ) {
        soaInput.searchOptions.focusColumnConfigId = focusColumnConfigId;
        awStateService.instance.go( '.', { s_columnConfigId: null } );
    }
    if ( focusTableConfigId ) {
        soaInput.searchOptions.focusTableConfigId = focusTableConfigId;
    }

    try {
        const response = await soaSvc.post( tableConfigsSoaServiceName, 'getTableConfigurations', {
            ...soaInput
        } );
        return JSON.parse( response.tableConfigurationsJson );
    } catch ( error ) {
        const errMessage = messageService.getSOAErrorMessage( error );
        messageService.showError( errMessage );
        return [];
    }
}

/**
 * Processes the response from getTableConfigurations SOA into tree nodes and returns the tree load result
 *
 * @param {Array<tableConfigsSoaResponse>} results array of table configurations from getTableConfigurations SOA
 * @param {TreeLoadInput} treeLoadInput input object for tree load containing parent node information
 * @param {UwSelectionModel} selectionModel selection model to set the selection for a node
 * @returns {TreeLoadResult} tree load result
 */
function processTableConfigsResponse( results, treeLoadInput, selectionModel ) {
    const treeNodesMap = {};

    const treeNodesArray = [];
    let childNdx = 0;

    for ( const vmo of results ) {
        let levelNdx = 1;
        if ( vmo.configurationType === 'Fnd0ClientScope' ) {
            levelNdx = 0;
        } else if ( vmo.configurationType === 'TableConfiguration' ) {
            levelNdx = 2;
        }
        const treeNode = awTableService.createViewModelTreeNode( vmo.tableConfigId, vmo.configurationType, vmo.displayName, levelNdx, childNdx, icons[ vmo.configurationType ] );
        treeNode.isLeaf = vmo.isLeaf;
        treeNode.props = {};

        for ( let prop in vmo.props ) {
            if ( vmo.props.hasOwnProperty( prop ) && prop !== 'isSelected' && prop !== 'isChildrenReturned' ) {
                let uiValue = vmo.props[ prop ].uiValue;
                let dbValue = vmo.props[ prop ].dbValue;
                treeNode.props[ prop ] = uwPropertySvc.createViewModelProperty( prop, uiValue, 'STRING', dbValue, [ uiValue ] );
            }
        }
        if ( vmo.configurationType === 'TableConfiguration' ) {
            treeNode.props.object_string = uwPropertySvc.createViewModelProperty( 'object_string', vmo.displayName, 'STRING', vmo.tableConfigId, [ vmo.displayName ] );
            treeNode.props.object_string.uiValues = [ vmo.displayName ];
            treeNode.props.object_string.dbValues = [ [ vmo.tableConfigId ] ];
            treeNode.props.object_string.displayValue = [ [ vmo.displayName ] ];
            treeNode.typeIconURL = icons[ vmo.configurationType ];
        }

        const treeNodeProps = uwPropertySvc.createViewModelProperty( 'typeDisplayName', vmo.typeDisplayName, 'STRING', vmo.typeDisplayName, [ vmo.typeDisplayName ] );
        treeNode.props.typeDisplayName = treeNodeProps;

        treeNode.parentTotalFound = treeLoadInput.parentNode.totalFound;
        treeNode.parentUid = vmo.parentTableConfigId;

        treeNodesArray.push( treeNode );

        treeNode.isExpanded = vmo.props.isChildrenReturned?.dbValue === 'true';
        if ( vmo.props.isSelected?.dbValue === 'true' ) {
            selectionModel?.setSelection( [ treeNode.uid ] );
        }
        if ( treeNode.levelNdx === 0 || treeNode.levelNdx === 1 ) {
            treeNodesMap[ treeNode.uid ] = treeNode;
        }
        if ( treeNode.levelNdx !== 0 && treeNodesMap[ treeNode.parentUid ] ) {
            if ( !treeNodesMap[ treeNode.parentUid ].children ) {
                treeNodesMap[ treeNode.parentUid ].children = [ treeNode ];
                treeNode.childNdx = 0;
            } else {
                treeNodesMap[ treeNode.parentUid ].children.push( treeNode );
                treeNode.childNdx = treeNodesMap[ treeNode.parentUid ].children.length - 1;
            }
        }
        ++childNdx;
    }

    return awTableService.buildTreeLoadResult( treeLoadInput, treeNodesArray, true, true, true, treeLoadInput.parentNode );
}

/**
 * Selects the client scope node and expands the tree to the site default of the client scope
 *
 * @param {TreeLoadResult} treeLoadResult tree load result with childNodes containing nodes from the initial load of the tree
 * @param {Array<SortCriteriaConfiguration>} sortCriteria sort criteria for soa input
 * @param {searchState} searchState search state for soa input
 * @param {DataProvider} dataProvider data provider to update with the new nodes
 * @param {UwSelectionModel} selectionModel selection model to set the selection for a node
 * @param {String} s_clientScopeUri client scope uri to select
 */
export async function selectClientScopeDefault( treeLoadResult, sortCriteria, searchState, dataProvider, selectionModel, s_clientScopeUri ) {
    if ( s_clientScopeUri ) {
        let clientScopeNodeIndex = treeLoadResult.childNodes.findIndex( node => node.displayName === s_clientScopeUri );
        if ( clientScopeNodeIndex > -1 ) {
            let clientScopeNode = treeLoadResult.childNodes[ clientScopeNodeIndex ];
            let nodeToSelect = clientScopeNode;

            if ( !clientScopeNode.isLeaf ) {
                // Expand the client scope node
                let clientScopeChildResults = await getTableConfigsData( { parentNode: clientScopeNode }, sortCriteria, searchState );
                let clientScopeChildTreeLoadResult = processTableConfigsResponse( clientScopeChildResults, { parentNode: clientScopeNode } );
                clientScopeNode.isExpanded = true;
                clientScopeNode.children = clientScopeChildTreeLoadResult.childNodes;

                // Site node will always be the first child of the client scope node
                let siteNode = clientScopeNode.children[0];

                // Expand the site node for the client scope
                let siteChildNodeResults = await getTableConfigsData( { parentNode: siteNode }, sortCriteria, searchState );
                let siteChildTreeLoadResult = processTableConfigsResponse( siteChildNodeResults, { parentNode: siteNode } );
                siteNode.isExpanded = true;
                siteNode.children = siteChildTreeLoadResult.childNodes;

                // Default configuration for site will always be the first child of the site node
                nodeToSelect = siteNode.children[0];

                let nodesUnderClientScope = [ ...clientScopeNode.children ];
                nodesUnderClientScope.splice( 1, 0, ...siteNode.children );

                treeLoadResult.childNodes.splice( clientScopeNodeIndex + 1, 0, ...nodesUnderClientScope );
            }

            dataProvider.update( treeLoadResult.childNodes );
            selectionModel.setSelection( [ nodeToSelect.uid ] );
        }
    }
}

/**
 * Loads table configurations data and returns the total found and tree load result
 *
 * @param {TreeLoadInput} treeLoadInput input object for tree load containing parent node information
 * @param {Array<SortCriteriaConfiguration>} sortCriteria sort criteria for soa input
 * @param {searchState} searchState search state for soa input
 * @param {String} focusColumnConfigId column configuration id to send to
 * @param {String} focusTableConfigId table configuration id to focus
 * @param {UwSelectionModel} selectionModel selection model to set the selection for a node
 * @param {Number} privilegeDbValue privilege value to check for access
 * @param {String} allowTableConfiguratorAccess server returns "true" or "false" to allow additional users to table configurator apart from privileged users.
 * @returns {Promise<{treeLoadResult: TreeLoadResult}>} totalFound and tree load result
 */
export async function loadTableConfigsData( treeLoadInput, sortCriteria, searchState, focusColumnConfigId = null, focusTableConfigId = null, selectionModel = null, privilegeDbValue = 1, allowTableConfiguratorAccess = 'true' ) {
    debouncedFilter.cancel();
    let isFiltered = searchState.criteria.searchString !== '';
    let isExpandingNode = treeLoadInput.parentNode.uid !== 'top';

    let results = [];
    if( privilegeDbValue === 0 && allowTableConfiguratorAccess === 'false' ) {
        const errMessage = await localeService.getLocalizedText( 'tableConfigsMessages', 'noAccessMessage' );
        messageService.showError( errMessage );
    } else if ( isFiltered && isExpandingNode ) {
        results = await getTableConfigsData( treeLoadInput, sortCriteria );
    } else {
        results = await getTableConfigsData( treeLoadInput, sortCriteria, searchState, focusColumnConfigId, focusTableConfigId );
    }

    const treeLoadResult = processTableConfigsResponse( results, treeLoadInput, selectionModel );
    return {
        treeLoadResult,
        fixTreeStructure: treeLoadInput.parentNode.type === 'Fnd0ClientScope' && treeLoadResult.childNodes[ 0 ].type === 'Site'
    };
}

/**
 * Filters table configurations data and updates the data provider
 * @param {Array<SortCriteriaConfiguration>} sortCriteria sort criteria
 * @param {searchState} searchState search state
 * @param {DataProvider} dataProvider data provider
 * @param {UwSelectionModel} selectionModel selection model to set the selection for a node
 */
export async function filterTableConfigsData( sortCriteria, searchState, dataProvider, selectionModel ) {
    debouncedFilter.cancel();
    let results = await getTableConfigsData( fakeTreeLoadInput, sortCriteria, searchState );

    let treeLoadResult = processTableConfigsResponse( results, fakeTreeLoadInput );

    dataProvider.update( treeLoadResult.childNodes );
    if ( selectionModel?.selectionData?.selected?.length > 0 ) {
        selectionModel.selectNone();
    }
}

const debouncedFilter = _.debounce( ( sortCriteria, searchState, dataProvider, selectionModel, searchString ) => {
    if( updateSearchString( searchState, searchString ) ) {
        filterTableConfigsData( sortCriteria, searchState, dataProvider, selectionModel );
    }
}, 350 );

/**
 * Debounces the filterTableConfigsData function
 * @param {Array<SortCriteriaConfiguration>} sortCriteria sort criteria
 * @param {searchState} searchState search state
 * @param {DataProvider} dataProvider data provider
 * @param {UwSelectionModel} selectionModel selection model to set the selection for a node
 * @param {String} searchString search string
 */
export function filterTableConfigsDataDebounced( sortCriteria, searchState, dataProvider, selectionModel, searchString ) {
    debouncedFilter( sortCriteria, searchState, dataProvider, selectionModel, searchString );
}

/**
 * Gets the selected object from the command context either from selection or selected
 * @param {object} commandContext - The command Context
 * @returns {object|undefined} - The selected object or undefined if no object found
 * @internal
 */
export function getSelectionFromCommandContext( commandContext ) {
    if( commandContext.selection && commandContext.selection.length >= 1 ) {
        return commandContext.selection[0];
    }
    if( commandContext.selected && commandContext.selected.length >= 1 ) {
        return commandContext.selected[0];
    }
    return undefined;
}

/**
 * Create a noty button
 * @param {String} label - button label
 * @param {Function} callback - callback function
 *
 * @return {Object} button object
 */
const createButton = function( label, callback ) {
    return {
        addClass: 'btn btn-notify',
        text: label,
        onClick: callback
    };
};

/**
 * Creates and displays a warning noty for confirmation with a cancel button and a custom confirm button and custom warning message
 * @param {String} cancelButtonLabel label for the cancel button
 * @param {String} confirmButtonLabel label for the confirm button
 * @param {String} warningMessage warning message
 * @returns {Promise} Promise that resolves if confirm button is clicked and rejects if we cancel button is clicked
 */
const createAndDisplayConfirmationNoty = async function( cancelButtonLabel, confirmButtonLabel, warningMessage ) {
    const prom = awPromiseSvc.instance.defer();
    const buttonsArr = [];
    buttonsArr.push( createButton( cancelButtonLabel, function( noty ) {
        noty.close();
        prom.reject();
    } ) );

    buttonsArr.push( createButton( confirmButtonLabel, function( noty ) {
        noty.close();
        prom.resolve();
    } ) );

    notySvc.showWarning( warningMessage, buttonsArr );
    return prom.promise;
};

/**
 * Deletes the selected table configuration, and any children if applicable.
 * @param {object} selectedTableConfig - selected table configuration
 * @param {DataProvider} dataProvider - data provider
 * @param {object} i18n - The localized strings
 */
export async function deleteTableConfig( selectedTableConfig, dataProvider, i18n ) {
    if( !selectedTableConfig ) {
        return;
    }
    const soaInput = {
        deleteOptions: {},
        tableConfigIdsToDelete: []
    };
    try {
        let deleteMessage;
        if ( selectedTableConfig.isLeaf ) {
            if ( selectedTableConfig.type === 'TableConfiguration' ) {
                deleteMessage = i18n.tableConfigDeleteTableConfig;
            } else {
                deleteMessage = i18n.tableConfigDeleteTable;
            }
        } else {
            deleteMessage = i18n.tableConfigsRemoveParentTableConfigText;
        }
        // This will reject promise if user cancels the delete operation, otherwise will resolve and we continue
        await createAndDisplayConfirmationNoty( i18n.cancel, i18n.delete, deleteMessage );

        const vmc = dataProvider.getViewModelCollection();
        const loadedVMObjects = vmc.getLoadedViewModelObjects();
        let uidsToRemove = [];
        let removeChildrenCallbacks = [];
        // First check if selected is leaf node or if it has children.
        if ( selectedTableConfig.isLeaf ) {
            soaInput.tableConfigIdsToDelete.push( selectedTableConfig.uid );
            uidsToRemove.push( selectedTableConfig.uid );
            // Check if this is Table object, or if it is a table configuration object
            if( selectedTableConfig.type === 'TableConfiguration' ) {
                // check if only child, if so then delete the parent scope level object as well
                const parentNode = loadedVMObjects.find( node => node.uid === selectedTableConfig.parentUid );
                if( parentNode.children?.length === 1 ) {
                    // Only child, remove the parent from the view modelCollection as well.
                    uidsToRemove.push( selectedTableConfig.parentUid );
                    // now check if this nodes parent (clientScopeUri) should become a leaf.
                    const clientScopeUriNode = loadedVMObjects.find( node => node.uid === parentNode.parentUid );
                    if( clientScopeUriNode.children?.length === 1 ) {
                        removeChildrenCallbacks.push( () => {
                            clientScopeUriNode.isLeaf = true;
                            clientScopeUriNode.isExpanded = false;
                            clientScopeUriNode.props.columnConfigId = uwPropertySvc.createViewModelProperty( 'columnConfigId', '', 'STRING', '', [ '' ] );
                            delete clientScopeUriNode.children;
                        } );
                    } else {
                        // If not only child, then just remove the parent node from the client scope uri children array
                        removeChildrenCallbacks.push( () => { clientScopeUriNode.children?.splice( clientScopeUriNode.children.findIndex( node => node.uid === parentNode.uid ), 1 ); } );
                    }
                } else {
                    // If not only child, then just remove the selected node from the parent children array
                    removeChildrenCallbacks.push( () => { parentNode.children?.splice( parentNode.children.findIndex( node => node.uid === selectedTableConfig.uid ), 1 ); } );
                }
            }
        } else if( selectedTableConfig.type === 'Fnd0ClientScope' ) {
            soaInput.tableConfigIdsToDelete.push( selectedTableConfig.uid );
            soaInput.deleteOptions.deleteAll = 'true';

            // Add this node plus all children to the local array to remove from view model collection
            uidsToRemove.push( selectedTableConfig.uid );
            if( selectedTableConfig.children ) {
                for ( const scopeNode of selectedTableConfig.children ) {
                    uidsToRemove.push( scopeNode.uid );
                    scopeNode.children?.map( tableConfigNode => uidsToRemove.push( tableConfigNode.uid ) );
                }
            }
        }

        // First submit delete soa if required
        if( soaInput.tableConfigIdsToDelete.length > 0 ) {
            try {
                await soaSvc.post( tableConfigsSoaServiceName, 'deleteTableConfigurations', soaInput );
            } catch( error ) {
                const errMessage = messageService.getSOAErrorMessage( error );
                messageService.showError( errMessage );
                return;
            }
        }

        // Now filter out any nodes to delete from view model collection, this will update the table.
        if( uidsToRemove.length > 0 ) {
            removeChildrenCallbacks.forEach( callback => callback() );
            let newVMObjects = loadedVMObjects.filter( node => !uidsToRemove.includes( node.uid ) );
            dataProvider.update( newVMObjects, newVMObjects.length );
            dataProvider.selectNone();
        }
    } catch( e ) {
        // User cancelled the delete operation, so do nothing
    }
}

/**
 * Adds the created table, the site, and default nodes to the tree and selects the default node
 *
 * @param {Array<SortCriteriaConfiguration>} sortCriteria sort criteria for soa input
 * @param {searchState} searchState search state
 * @param {DataProvider} dataProvider data provider
 * @param {Array<tableConfigsSoaResponse>} createdTableData created table data containing the table, site, and default nodes
 * @param {UwSelectionModel} selectionModel selection model to set the selection for a node
 */
export async function loadAndSelectNewTableDefault( sortCriteria, searchState, dataProvider, createdTableData, selectionModel ) {
    const vmCollection = dataProvider.getViewModelCollection();
    const treeNodes = vmCollection.getLoadedViewModelObjects();
    const parentTableNodes = ( await loadTableConfigsData( fakeTreeLoadInput, sortCriteria, searchState ) ).treeLoadResult.childNodes;
    const newTableNodeIndex = parentTableNodes.findIndex( node => node.uid === createdTableData[ 0 ].tableConfigId );
    const createdNodes = [ parentTableNodes[ newTableNodeIndex ] ];

    let insertIndex = newTableNodeIndex === 0 ? 0 : vmCollection.findViewModelObjectById( parentTableNodes[ newTableNodeIndex - 1 ].uid );
    if ( newTableNodeIndex !== 0 && treeNodes[ insertIndex ].children ) {
        let addToInsertIndex = 0;
        addToInsertIndex += treeNodes[ insertIndex ].children.length;
        for ( const intermediateNode of treeNodes[ insertIndex ].children ) {
            if ( intermediateNode.children ) {
                addToInsertIndex += intermediateNode.children.length;
            }
        }
        insertIndex += addToInsertIndex;
    }
    createdNodes.push( ...processTableConfigsResponse( [ createdTableData[ 1 ], createdTableData[ 2 ] ], { parentNode: createdNodes[ 0 ] } ).childNodes );
    createdNodes[ 0 ].isExpanded = true;
    createdNodes[ 0 ].children = createdNodes.slice( 1, 2 );
    createdNodes[ 1 ].isExpanded = true;
    createdNodes[ 1 ].children = createdNodes.slice( 2 );
    insertTableConfigNodes( treeNodes, createdNodes, insertIndex === 0 ? insertIndex : insertIndex + 1, 0, dataProvider, createdTableData[ 2 ].tableConfigId, selectionModel );
}

/**
 * Adds the created table configuration to the tree and selects the new table configuration in the correct place
 *
 * @param {Array<SortCriteriaConfiguration>} sortCriteria sort criteria for soa input
 * @param {searchState} searchState search state
 * @param {DataProvider} dataProvider data provider
 * @param {Array<tableConfigsSoaResponse>} createdTableConfigData created table configuration data containing the table, intermediate, and created table config nodes
 * @param {ViewModelTreeNode} operatedNode node that the operation was performed on
 * @param {UwSelectionModel} selectionModel selection model to set the selection for a node
 */
export async function selectNewTableConfig( sortCriteria, searchState, dataProvider, createdTableConfigData, operatedNode, selectionModel ) {
    const vmCollection = dataProvider.getViewModelCollection();
    let treeNodes = vmCollection.getLoadedViewModelObjects();

    // Start checking from the root Table node, if the action was Add Table Configuration then operatedNode is already the root Table node, otherwise get the root Table node
    let parentNode = operatedNode;
    if ( operatedNode.type !== 'Fnd0ClientScope' ) {
        let parentNodeIndex = vmCollection.findViewModelObjectById( createdTableConfigData[ 0 ].tableConfigId );
        parentNode = vmCollection.getViewModelObject( parentNodeIndex );
    }
    // In order to add the new table configuration to the correct spot, we need to call the SOA for the proper order of the nodes
    if ( parentNode.isExpanded ) {
        const intermediateNodeIndex = vmCollection.findViewModelObjectById( createdTableConfigData[ 1 ].tableConfigId );
        // If the intermediate node is present, then just load and replace the nodes under it and select the new node
        if ( intermediateNodeIndex > -1 ) {
            const intermediateNode = vmCollection.getViewModelObject( intermediateNodeIndex );
            const intermediateNodeChildren = ( await loadTableConfigsData( { parentNode: intermediateNode }, sortCriteria, searchState ) ).treeLoadResult.childNodes;
            const deleteCount = intermediateNode.children ? intermediateNode.children.length : 0;
            intermediateNode.children = intermediateNodeChildren;
            intermediateNode.isExpanded = true;
            insertTableConfigNodes( treeNodes, intermediateNodeChildren, intermediateNodeIndex + 1, deleteCount, dataProvider, createdTableConfigData[ 2 ].tableConfigId, selectionModel );
            return;
        }
        // If the intermediate node is not present, then load the nodes under the parent node and insert the new nodes in the correct spot in the tree
        // It is done like this to maintain the expanded state of any node the user has expanded
        const parentNodeChildren = ( await loadTableConfigsData( { parentNode: parentNode }, sortCriteria, searchState ) ).treeLoadResult.childNodes.filter( node => node.type !== 'TableConfiguration' );
        const createdIntermediateNodeIndex = parentNodeChildren.findIndex( node => node.uid === createdTableConfigData[ 1 ].tableConfigId );
        const createdNodes = [ parentNodeChildren[ createdIntermediateNodeIndex ] ];
        parentNode.children.splice( createdIntermediateNodeIndex, 0, createdNodes[ 0 ] );
        const intermediateNodeChildren = ( await loadTableConfigsData( { parentNode: createdNodes[ 0 ] }, sortCriteria, searchState ) ).treeLoadResult.childNodes;
        createdNodes.push( ...intermediateNodeChildren );
        createdNodes[ 0 ].children = intermediateNodeChildren;
        createdNodes[ 0 ].isExpanded = true;
        let insertIndex = createdIntermediateNodeIndex === 0 ? vmCollection.findViewModelObjectById( parentNode.uid )
            : vmCollection.findViewModelObjectById( parentNodeChildren[ createdIntermediateNodeIndex - 1 ].uid );
        if ( createdIntermediateNodeIndex !== 0 && treeNodes[ insertIndex ].children ) {
            insertIndex += treeNodes[ insertIndex ].children.length;
        }
        insertTableConfigNodes( treeNodes, createdNodes, insertIndex + 1, 0, dataProvider, createdTableConfigData[ 2 ].tableConfigId, selectionModel );
        return;
    }
    if ( parentNode.isLeaf ) {
        // If parent node is a leaf node, then we have to add the new column config id from the user onto the props
        const uiValue = createdTableConfigData[ 0 ].props.columnConfigId.uiValue;
        const dbValue = createdTableConfigData[ 0 ].props.columnConfigId.dbValue;
        parentNode.props.columnConfigId = uwPropertySvc.createViewModelProperty( 'columnConfigId', uiValue, 'STRING', dbValue, [ uiValue ] );
    }
    // If parent node is not expanded already, then simply load the necessary nodes and insert them and select the newly created node
    const parentNodeChildren = ( await loadTableConfigsData( { parentNode: parentNode }, sortCriteria, searchState ) ).treeLoadResult.childNodes.filter( node => node.type !== 'TableConfiguration' );
    parentNode.isExpanded = true;
    parentNode.isLeaf = false;
    parentNode.children = parentNodeChildren;
    insertTableConfigNodes( treeNodes, parentNodeChildren, vmCollection.findViewModelObjectById( parentNode.uid ) + 1, 0, dataProvider );
    treeNodes = vmCollection.getLoadedViewModelObjects();

    const intermediateNodeIndex = vmCollection.findViewModelObjectById( createdTableConfigData[ 1 ].tableConfigId );
    const intermediateNode = vmCollection.getViewModelObject( intermediateNodeIndex );
    const intermediateNodeChildren = ( await loadTableConfigsData( { parentNode: intermediateNode }, sortCriteria, searchState ) ).treeLoadResult.childNodes;
    intermediateNode.isExpanded = true;
    intermediateNode.children = intermediateNodeChildren;
    insertTableConfigNodes( treeNodes, intermediateNodeChildren, intermediateNodeIndex + 1, 0, dataProvider, createdTableConfigData[ 2 ].tableConfigId, selectionModel );
}

/**
 * Inserts new nodes into the tree and updates the data provider.
 *
 * @param {Array<ViewModelTreeNode>} treeNodes tree nodes to insert new nodes into
 * @param {Array<ViewModelTreeNode>} insertNodes nodes to insert
 * @param {Number} insertIndex index to insert nodes at
 * @param {Number} deleteCount number of nodes to delete
 * @param {DataProvider} dataProvider data provider to update with the new nodes
 * @param {String} selectionUid uid of the node to select
 * @param {UwSelectionModel} selectionModel selection model to set the selection for a node
 */
function insertTableConfigNodes( treeNodes, insertNodes, insertIndex, deleteCount, dataProvider, selectionUid = null, selectionModel = null ) {
    treeNodes.splice( insertIndex, deleteCount, ...insertNodes );
    dataProvider.update( treeNodes );
    if ( selectionUid && selectionModel ) {
        selectionModel.setSelection( [ selectionUid ] );
    }
}

/**
 * Calls createTableConfiguration SOA to create a new table configuration, if the table configuration already exists, it will provide a popup to overwrite the existing configuration
 *
 * @param {String} columnConfigIdForLeafTable column configuration id provided in add panel when table is a leaf node
 * @param {String} scope scope under which to create the table configuration
 * @param {String} scopeName scope name under which to create the table configuration if the scope is group, role, or workspace
 * @param {String} tableConfigName name of the table configuration to create if the scope is site
 * @param {ViewModelTreeNode} operatedNode node that the operation was performed on
 * @param {Object} i18n localized strings
 * @returns {Object} response from createTableConfiguration SOA
 */
export async function createTableConfig( columnConfigIdForLeafTable, scope, scopeName, tableConfigName, operatedNode, i18n ) {
    try {
        return await soaSvc.post( tableConfigsSoaServiceName, 'createTableConfiguration',
            createTableConfigurationSoaOptionsInput( operatedNode.props?.columnConfigId.uiValue.length > 0 ? operatedNode.props.columnConfigId.uiValue : columnConfigIdForLeafTable,
                scope, scopeName, tableConfigName, operatedNode ) );
    } catch ( error ) {
        // If the table configuration already exists, provide a popup to overwrite the existing configuration
        const errorCode = error.cause.partialErrors[ 0 ].errorValues[ 0 ].code;
        let errMessage;
        if ( errorCode === 141342 ) {
            let overwriteMessage;
            switch ( scope ) {
                case 'Site':
                    overwriteMessage = i18n.tableConfigNameExists;
                    break;
                case 'Group':
                    overwriteMessage = i18n.selectedGroupExists;
                    break;
                case 'Role':
                    overwriteMessage = i18n.selectedRoleExists;
                    break;
                case 'Workspace':
                    overwriteMessage = i18n.selectedWorkspaceExists;
                    break;
            }
            // For add table config case, operatedNode type will always be Fnd0ClientScope, otherwise it is save as case
            overwriteMessage = operatedNode.type === 'Fnd0ClientScope' ? overwriteMessage.concat( ' ', i18n.addTableConfigOverwriteMessage ) : overwriteMessage.concat( ' ', i18n.saveAsOverwriteMessage );
            await createAndDisplayConfirmationNoty( i18n.cancel, i18n.overwrite, overwriteMessage );
            // An overwrite case will never encounter the column config id from the user in the panel, so just send column config id
            try {
                return await soaSvc.post( tableConfigsSoaServiceName, 'createTableConfiguration',
                    createTableConfigurationSoaOptionsInput( operatedNode.props?.columnConfigId.uiValue, scope, scopeName, tableConfigName, operatedNode, true ) );
            } catch ( error ) {
                errMessage = messageService.getSOAErrorMessage( error );
            }
        } else if ( errorCode === 515106 ) {
            errMessage = i18n.columnConfigIdExistsMessage.replace( '{0}', columnConfigIdForLeafTable );
        } else {
            errMessage = messageService.getSOAErrorMessage( error );
        }
        messageService.showError( errMessage );
    }
    return null;
}

/**
 * Creates an input object for createTableConfiguration SOA
 *
 * @param {String} columnConfigId column configuration id of the table under which to create the table configuration
 * @param {String} scope scope under which to create the table configuration
 * @param {String} scopeName scope name under which to create the table configuration if the scope is group, role, or workspace
 * @param {String} tableConfigName name of the table configuration to create if the scope is site
 * @param {ViewModelTreeNode} operatedNode node that the operation was performed on
 * @param {Boolean} overwrite flag to indicate if the table configuration should be overwritten if it already exists
 * @returns {Object} input object for createTableConfiguration SOA
 */
function createTableConfigurationSoaOptionsInput( columnConfigId, scope, scopeName, tableConfigName, operatedNode, overwrite = false ) {
    const soaInput = {
        columnConfigId,
        createOptions: {
            scope
        }
    };
    if ( overwrite ) {
        soaInput.createOptions.action = 'overwrite';
    }

    // For add table config case, operatedNode type will always be Fnd0ClientScope, otherwise it is save as case
    if ( operatedNode.type === 'Fnd0ClientScope' ) {
        soaInput.createOptions.parentTableConfigId = operatedNode.uid;
    } else {
        soaInput.createOptions.originalTableConfigId = operatedNode.uid;
    }

    if ( scope === 'Site' ) {
        soaInput.createOptions.tableConfigName = tableConfigName;
    } else { // Adding a group, role, or workspace override table config
        soaInput.createOptions.scopeName = scopeName;
    }
    return soaInput;
}

/**
 * Calls SOA to get table configuration properties and returns the response array or displays error message if SOA rejects
 * @param {String} clientScopeUri client scope uri
 * @param {String} columnConfigId column configuration id
 * @returns {Promise<String>} array of table configuration properties from getTableConfigurationProperties SOA
 */
export async function createTable( clientScopeUri, columnConfigId ) {
    try{
        return await soaSvc.post( tableConfigsSoaServiceName, 'createTableConfiguration', { clientScopeUri, columnConfigId } );
    } catch( error ) {
        const errorCode = error.cause.partialErrors[ 0 ].errorValues[ 0 ].code;
        let errMessage;
        if ( errorCode === 141164 ) {
            errMessage = error.cause.partialErrors[ 0 ].errorValues[ 0 ].message;
        } else if ( errorCode === 515106 ) {
            errMessage = ( await localeService.getLocalizedText( 'tableConfigsMessages', 'columnConfigIdExistsMessage' ) ).replace( '{0}', columnConfigId );
        } else {
            errMessage = messageService.getSOAErrorMessage( error );
        }
        messageService.showError( errMessage );
    }
    return null;
}

/**
 * Fixes the tree structure by removing TableConfiguration nodes from the client scope children array
 * @param {DataProvider} dataProvider data provider
 */
export function fixTreeStructure( dataProvider ) {
    const vmCollection = dataProvider.getViewModelCollection();
    let treeNodes = vmCollection.getLoadedViewModelObjects();
    for ( const node of treeNodes ) {
        let index = node.type === 'Fnd0ClientScope' && node.children ? node.children?.findIndex( child => child.type === 'TableConfiguration' ) : -1;
        if ( index > -1 ) {
            while ( index > -1 ) {
                node.children.splice( index, 1 );
                index = node.children.findIndex( child => child.type === 'TableConfiguration' );
            }
            dataProvider.update( treeNodes );
            return;
        }
    }
}

/**
 * Updates search state with the new search string
 * @param {Object} searchState search state
 * @param {String} searchString search string
 * @returns {Boolean} true if the search string is the same as the old search string, false otherwise
 */
export function updateSearchString( searchState, searchString ) {
    let oldSearchString = searchState.criteria.searchString;
    if ( searchString !== oldSearchString ) {
        const newSearchState = { ...searchState.value };
        newSearchState.criteria.searchString = searchString;
        searchState.update( newSearchState );
    }
    return oldSearchString !== searchString;
}

/**
 * Clears the search box
 * @param {Object} searchBox search box field
 */
export function clearSearchBox( searchBox ) {
    searchBox.update( '' );
}
