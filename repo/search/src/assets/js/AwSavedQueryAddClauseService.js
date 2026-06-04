// @<COPYRIGHT>@
// ==================================================
// Copyright 2024.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/* global */

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/AwSavedQueryAddClauseService
 */

import AwPromiseService from 'js/awPromiseService';
import soaService from 'soa/kernel/soaService';
import cmm from 'soa/kernel/clientMetaModel';
import localeSvc from 'js/localeService';
import _ from 'lodash';

export let renameKeys = function( typeDescriptionsTypes ) {
    let typeDescriptionsTypesRoot = typeDescriptionsTypes[ 0 ];
    typeDescriptionsTypesRoot[ 'childrenOld' ] = typeDescriptionsTypesRoot[ 'children' ];
    typeDescriptionsTypesRoot[ 'children' ] = typeDescriptionsTypesRoot[ 'propertyDescriptors' ];
    delete typeDescriptionsTypesRoot[ 'propertyDescriptors' ];
    return typeDescriptionsTypes;
};

export let expandRoot = function( tree ) {
    tree[ 0 ].expanded = true;
    collapseChildren( tree[ 0 ].children );
    return tree;
};

let collapseChildren = function( children ) {
    children.forEach( function( child ) {
        child.expanded = false;
        if( child.children ) {
            collapseChildren( child.children );
        }
    } );
};

let expandChildren = function( children ) {
    children.forEach( function( child ) {
        if( child.children && child.children.length !== 0 && !child.children[ 0 ].dummyChildProperty ) {
            child.expanded = true;
            expandChildren( child.children );
        }
    } );
};

export let updateTreeSelection = function( node, searchState ) {
    let newSearchstate = searchState ? { ...searchState.getValue() } : {};
    if( node ) {
        node.selected = true;
    }
    newSearchstate.selectedNode = node;
    searchState.update( newSearchstate );
    return node;
};

export let clearSelectedNode = function( tree, filteredTree, searchState ) {
    const deselectNodes = function( tree ) {
        tree.forEach( function( child ) {
            child.selected = false;
            if( child.children && child.children.length !== 0 && !child.children[ 0 ].dummyChildProperty ) {
                deselectNodes( child.children );
            }
        } );
    };

    let newSearchState = searchState ? { ...searchState.getValue() } : {};
    if( newSearchState.selectedNode ) {
        deselectNodes( tree );
        deselectNodes( filteredTree );
        delete newSearchState.selectedNode;
    }
    searchState.update( newSearchState );
    return null;
};

export let filterTreeByPropertyTypes = function( tree, types ) {
    const filterOutNonMatchingProperties = function( children ) {
        for( let i = children.length - 1; i >= 0; i-- ) {
            const child = children[ i ];
            if( !types.includes( child.propertyType ) ) {
                children.splice( i, 1 );
            }
            else if( child.children ) {
                filterOutNonMatchingProperties( child.children );
            }
        }
    };

    filterOutNonMatchingProperties( tree[ 0 ].children );

    return tree;
};

export let filterTreeByQuery = function( searchQuery, tree ) {
    if( !searchQuery ) {
        return tree;
    }

    const filterNode = function( node ) {
        const nameMatch = node.displayName.toLowerCase().includes( searchQuery.toLowerCase() ) || node.name.toLowerCase().includes( searchQuery.toLowerCase() );

        if( node.children && node.children.length > 0 && !node.children[ 0 ].dummyChildProperty ) {
            node.children = node.children.filter( child => filterNode( child ) );
        }

        return nameMatch || ( node.children && node.children.length > 0 && !node.children[ 0 ].dummyChildProperty );
    };

    let treeCopy = _.cloneDeep( tree );
    let newFilteredTree = treeCopy.filter( node => filterNode( node ) );

    if( newFilteredTree && newFilteredTree[ 0 ] && newFilteredTree[ 0 ].children && newFilteredTree[ 0 ].children.length > 0 && !newFilteredTree[ 0 ].children[ 0 ].dummyChildProperty ) {
        expandChildren( newFilteredTree[ 0 ].children );
    }

    return newFilteredTree;
};

export let getNodeByHierarchyString = function( tree, nodeHierarchyString ) {
    const getNodeFromHierarchyString2 = function( children ) {
        children.forEach( function( child ) {
            if( child.hierarchyString === nodeHierarchyString ) {
                node = child;
            }
            if( child.children && child.children.length !== 0 && !child.children[ 0 ].dummyChildProperty ) {
                getNodeFromHierarchyString2( child.children );
            }
        } );
    };
    let node = {};
    getNodeFromHierarchyString2( tree[ 0 ].children );

    return node;
};

export let sortPropertiesByDisplayName = function( tree ) {
    const sortChildren = function( children ) {
        children.sort( ( a, b ) => {
            return a.displayName.localeCompare( b.displayName );
        } );
        children.forEach( function( child ) {
            if( child.children ) {
                sortChildren( child.children );
            }
        } );
    };
    if( tree.length === 0 ) {
        return tree;
    }

    sortChildren( tree[ 0 ].children );

    return tree;
};

export let removeDuplicateProperties = function( tree ) {
    let removeDuplicateProperties2 = function( children ) {
        return Array.from( new Map( children.map( property => [ property.name, property ] ) ).values() );
    };

    let uniqueProperties = removeDuplicateProperties2( tree[ 0 ].children );
    tree[ 0 ].children = uniqueProperties;

    return tree;
};

export let updateHierarchyString = function ( tree, childHierarchyPath ) {
    tree[ 0 ].children.forEach( function( child ) {
        if( !child.hierarchyString ) {
            if( childHierarchyPath ) {
                child.hierarchyString = childHierarchyPath + '.' + child.name;
            }
            else {
                child.hierarchyString = child.name;
            }
        }
    } );
    return tree;
};

export let addDummyChildren = function ( tree, workspaceObjectSubTypes ) {
    let selectTypeText = localeSvc.getLoadedText( 'SearchMessages' ).selectTypeText;

    tree[ 0 ].children.forEach( function( child ) {
        if( ( child.propertyType === 2 || child.propertyType === 3 ) && !child.children ) {
            let propertyReferencedType = child.constants.find( property => property.name === 'ReferencedTypeName' );
            if( propertyReferencedType ) {
                let expandNodeReferenceType = '';
                if( child.name === 'owning_user' || child.name === 'last_mod_user' ) {
                    expandNodeReferenceType = 'User';
                }
                else if( child.name === 'owning_group' ) {
                    expandNodeReferenceType = 'Group';
                }
                else {
                    expandNodeReferenceType = propertyReferencedType.value;
                }
                child.children = [
                    {
                        dummyChildProperty: '__dummy_child__'
                    }
                ];
                child.isReferencedProperty = true;
                child.textForType = expandNodeReferenceType;
                child.originalReferenceType = expandNodeReferenceType;
                child.isReferenceTypeSubTypeOfWorkspaceObject = isTypeSubTypeOfWorkspaceObject( expandNodeReferenceType, workspaceObjectSubTypes );
            }
            else {
                child.textForType = selectTypeText;
                child.isReferencedProperty = false;
            }
        }
    } );
    return tree;
};

export let addDummyChildrenAfterFiltering = function ( tree, data ) {
    if( tree.length === 0 ) {
        return tree;
    }

    const addChildren = function( children ) {
        children.forEach( function( child ) {
            if( child.propertyType === 2 && child.constants.find( property => property.name === 'ReferencedTypeName' ) ) {
                if( child.children.length === 0 ) {
                    child.children = [
                        {
                            dummyChildProperty: '__dummy_child__'
                        }
                    ];
                }
                else {
                    addChildren( child.children );
                }
            }
        } );
    };

    addChildren( tree[ 0 ].children );
    data.dispatch( { path: 'data', value: tree } );
    return tree;
};


export let assignChildTreeToParent = function( tree, childTree, childHierarchyPath ) {
    if( !tree ) {
        return childTree;
    }

    const setChildToParent = function( children ) {
        children.forEach( function( child ) {
            if( child.hierarchyString === childHierarchyPath ) {
                child.expanded = true;
                child.children = childTree[ 0 ].children;
            }
            else if( child.children && !child.children[ 0 ].dummyChildProperty ) {
                setChildToParent( child.children );
            }
        } );
    };

    setChildToParent( tree[ 0 ].children );
    return tree;
};

export let expandAction = function( tree, node, workspaceObjectSubTypes ) {
    let expandNodeReferenceType = '';
    if( node.propertyType === 2 || node.propertyType === 3 ) {
        let propertyReferencedType = node.constants.find( property => property.name === 'ReferencedTypeName' );
        if( propertyReferencedType ) {
            if( node.name === 'owning_user' || node.name === 'last_mod_user' ) {
                expandNodeReferenceType = 'User';
            }
            else if( node.name === 'owning_group' ) {
                expandNodeReferenceType = 'Group';
            }
            else {
                expandNodeReferenceType = propertyReferencedType.value;
            }
        }
    }

    let inputData = {
        typeNames: [ expandNodeReferenceType ]
    };

    let deferred = AwPromiseService.instance.defer();
    soaService.postUnchecked( 'Core-2015-10-Session', 'getTypeDescriptions2', inputData ).then( function( response ) {
        let childTree = renameKeys( response.types );
        childTree = expandRoot( childTree );
        childTree = removeNonSelectedTypesFromTree( childTree );
        childTree = filterTreeByPropertyTypes( childTree, [ 1, 2, 3 ] );
        childTree = sortPropertiesByDisplayName( childTree );
        childTree = removeDuplicateProperties( childTree );
        childTree = filterOutLongStringPropTypes( childTree );
        childTree = updateHierarchyString( childTree, node.hierarchyString );
        childTree = addDummyChildren( childTree, workspaceObjectSubTypes );
        tree = assignChildTreeToParent( tree, childTree, node.hierarchyString );
        deferred.resolve( tree );
    } );

    return deferred.promise;
};

export let switchViewMode = function( newViewMode ) {
    setAddClausePanelDisplayNameInternalNamePref( newViewMode );
    return newViewMode;
};

export let switchTypeOrAllProperties = function( newTypeOrAllMode ) {
    setAddClausePanelTypePropertyAllPropertyPref( newTypeOrAllMode );
    return newTypeOrAllMode;
};

export let parseParentTypeProperties = function( parentTypes ) {
    return parentTypes.types[ 0 ].propertyDescriptors.map( property => property.name );
};


export let filterTreeByTypeProperties = function( tree, filteredTreeByQuery, searchBoxValue, typeOrAllProperties, parentPropertyDescriptors ) {
    let treeToFilterOn = searchBoxValue ? filteredTreeByQuery : tree;
    if( typeOrAllProperties === 'allProperties' || treeToFilterOn.length === 0 ) {
        return treeToFilterOn;
    }

    const filterOutInheritedProperties = function( children ) {
        let filteredChildren = [];

        for( let i = 0; i < children.length; i++ ) {
            const child = children[ i ];
            if( !parentPropertyDescriptors.includes( child.name ) || child.isBackwardsReference ) {
                const filteredChild = {
                    ...child
                };
                if( child.children && child.children.length !== 0 && !child.children[ 0 ].dummyChildProperty ) {
                    filteredChild.children = filterOutInheritedProperties( child.children );
                }
                filteredChildren.push( filteredChild );
            }
        }

        return filteredChildren.length === 0 ? [] : filteredChildren;
    };

    let filteredChildren = filterOutInheritedProperties( treeToFilterOn[ 0 ].children );

    let newFilteredTree = [];
    if( filteredChildren ) {
        newFilteredTree = [
            {
                ...treeToFilterOn[ 0 ],
                children: filteredChildren
            }
        ];
    }

    return newFilteredTree;
};

export let updateSubPanelContextForTypeSelectionPopup = function( subPanelContext, viewModel ) {
    let selectedNode = subPanelContext.context.searchState.selectedNode;
    let selectTypeContext = { isSubTypeSelection: selectedNode.isReferenceTypeSubTypeOfWorkspaceObject, isReferencedBy: false, selectedNode: selectedNode, parentViewModel: viewModel, ...subPanelContext };
    let newSearchState = subPanelContext.context.searchState ? { ...subPanelContext.context.searchState.getValue() } : {};
    newSearchState.selectTypeContext = selectTypeContext;
    subPanelContext.context.searchState.update( newSearchState );
};

export let renameKeysForTypeHierarchyTree = function( tree ) {
    tree.forEach( function( child ) {
        child[ 'children' ] = child[ 'subTypes' ];
        child[ 'label' ] = child[ 'typeDisplayName' ];
        child[ 'value' ] = child[ 'typeInternalName' ];
        delete child[ 'subTypes' ];
        delete child[ 'typeDisplayName' ];
        delete child[ 'typeInternalName' ];
        if( child.children && child.children.length > 0 ) {
            renameKeysForTypeHierarchyTree( child.children );
        }
        else {
            delete child[ 'children' ];
        }
    } );

    return tree;
};

export let updateSelectedType = function( selectedType, node ) {
    if( selectedType && selectedType !== node ) {
        selectedType.selected = false;
    }

    return node;
};

export let confirmSelectTypeNonReferencedByProperty = async function( selectedType, selectedProperty, parentViewModel ) {
    let node = getNodeByHierarchyString( parentViewModel.tree, selectedProperty.hierarchyString );
    let filteredTreeNode = getNodeByHierarchyString( parentViewModel.filteredTree, selectedProperty.hierarchyString );

    let previousReferenceValue = node.constants.find( property => property.name === 'ReferencedTypeName' )?.value;
    if( previousReferenceValue ) {
        let index = node.constants.findIndex( property => property.name === 'ReferencedTypeName' );
        node.constants.splice( index, 1 );
    }
        
    node.constants.push( {
        name: 'ReferencedTypeName',
        value: selectedType.value
    } );

    node.textForType = selectedType.value;

    let newHierarchyString = '';
    if( node.originalReferenceType === selectedType.value ) {
        newHierarchyString = selectedProperty.name;
    }
    else {
        newHierarchyString = selectedType.value + ':' + selectedProperty.name;
    }
    if( previousReferenceValue && node.originalReferenceType !== previousReferenceValue ) {
        let stringToReplace = previousReferenceValue + ':' + selectedProperty.name;
        node.hierarchyString = node.hierarchyString.replace( stringToReplace, newHierarchyString );
    }
    else {
        node.hierarchyString = node.hierarchyString.replace( selectedProperty.name, newHierarchyString );
    }

    filteredTreeNode.constants = node.constants;
    filteredTreeNode.textForType = node.textForType;
    filteredTreeNode.hierarchyString = node.hierarchyString;

    node.selected = true;
    filteredTreeNode.selected = true;
    let newSearchState = { ...parentViewModel.subPanelContext.context.searchState.getValue() };
    newSearchState.selectedNode = node;
    parentViewModel.subPanelContext.context.searchState.update( newSearchState );


    expandAction2( node, parentViewModel );
};

export let filterTypesBySearchBox = function( searchQuery, tree ) {
    if( !tree ) {
        return tree;
    }

    const filterNode = function( node ) {
        const nameMatch = node.value.toLowerCase().includes( searchQuery.toLowerCase() ) || node.label.toLowerCase().includes( searchQuery.toLowerCase() );

        let filteredChildren = [];
        if( node.children && node.children.length > 0 ) {
            filteredChildren = node.children.map( child => filterNode( child ) ).filter( child => child !== null );
        }

        return nameMatch || filteredChildren.length > 0 ? { ...node, children: filteredChildren } : null;
    };

    let newFilteredTree = tree.map( node => filterNode( node ) ).filter( node => node !== null );
    if( searchQuery.length > 1 ) {
        expandChildren( newFilteredTree );
    }
    else {
        collapseChildren( newFilteredTree[ 0 ].children );
    }

    return newFilteredTree;
};

export let expandAction2 = async function( node, viewModel ) {
    let { data, dispatch } = viewModel;
    let { tree, filteredTree, typeOrAllProperties, searchBox, parentTypeProperties } = data;

    let updatedTree = await expandAction( tree, node, viewModel.subPanelContext.workspaceObjectSubTypes );
    dispatch( { path: 'data', value: updatedTree } );
    if( searchBox.dbValue || typeOrAllProperties === 'typeProperties' ) {
        let updatedNode = AwSavedQueryAddClauseService.getNodeByHierarchyString( updatedTree, node.hierarchyString );
        let updatedFilteredTree = AwSavedQueryAddClauseService.assignChildTreeToParent( filteredTree, [ updatedNode ], node.hierarchyString );
        if( typeOrAllProperties === 'typeProperties' ) {
            updatedFilteredTree = AwSavedQueryAddClauseService.filterTreeByTypeProperties( updatedTree, updatedFilteredTree, searchBox.dbValue, 
                    typeOrAllProperties, parentTypeProperties );
            dispatch( { path: 'data.filteredTree', value: updatedFilteredTree } );
        }
        else {
            dispatch( { path: 'data', value: updatedFilteredTree } );
        }
    }
};

export let getTypeSelectionPanelTitle = ( selectTypeCaption, selectedPropertyName, addReferenceForText, subTypeSelectionText, isReferencedBy, isSubTypeSelection ) => {
    if( isReferencedBy ) {
        return addReferenceForText.replace( '{0}', selectedPropertyName );
    }
    if( isSubTypeSelection ) {
        return subTypeSelectionText.replace( '{0}', selectedPropertyName );
    }
    return selectTypeCaption.replace( '{0}', selectedPropertyName );
};

export let getAddClausePanelDisplayNameInternalNamePref = () => {
    let displayNameInternalName = sessionStorage.getItem( 'addClausePanelDisplayNameInternalNamePref' );
    if( !displayNameInternalName ) {
        setAddClausePanelDisplayNameInternalNamePref( 'displayName' );
        return 'displayName';
    }
    return displayNameInternalName;
};

export let setAddClausePanelDisplayNameInternalNamePref = ( displayNamesInternalNames ) => {
    sessionStorage.setItem( 'addClausePanelDisplayNameInternalNamePref', displayNamesInternalNames );
};

export let getAddClausePanelTypePropertyAllPropertyPref = () => {
    let typePropertiesAllProperties = sessionStorage.getItem( 'addClausePanelTypePropertyAllPropertyPref' );
    if( !typePropertiesAllProperties ) {
        setAddClausePanelTypePropertyAllPropertyPref( 'typeProperties' );
        return 'typeProperties';
    }
    return typePropertiesAllProperties;
};

export let setAddClausePanelTypePropertyAllPropertyPref = ( typePropertiesAllProperties ) => {
    sessionStorage.setItem( 'addClausePanelTypePropertyAllPropertyPref', typePropertiesAllProperties );
};

export let confirmSelectProperty = async function( referencedByNode, selectedType, selectedProperty, parentViewModel ) {
    let tree = parentViewModel.tree;

    // If the node which we are adding the referenced by property on hasn't been expanded yet, fetch children
    if( referencedByNode.children[ 0 ].dummyChildProperty ) {
        tree = await expandAction( tree, referencedByNode, parentViewModel.subPanelContext.workspaceObjectSubTypes );
    }

    let nodeFromTree = {};
    if( referencedByNode.name === parentViewModel.tree[ 0 ].name ) {
        nodeFromTree = tree[ 0 ];
    }
    else {
        nodeFromTree = getNodeByHierarchyString( tree, referencedByNode.hierarchyString );
    }
    nodeFromTree.expanded = true;

    let newNodeHierarchyBackwardsReference = selectedType + '<-' + selectedProperty.name;
    let newBackwardsReferenceNode = {
        children: [ {
            dummyChildProperty: '__dummy_child__'
        } ],
        constants: [ {
            name: 'ReferencedTypeName',
            value: selectedType
        } ],
        displayName: selectedProperty.displayName,
        expanded: false,
        hierarchyString: nodeFromTree.hierarchyString ? nodeFromTree.hierarchyString + '.' + newNodeHierarchyBackwardsReference : newNodeHierarchyBackwardsReference,
        isReferencedProperty: true,
        isBackwardsReference: true,
        name: selectedProperty.name,
        textForType: selectedType,
        propertyType: 2,
        valueType: 9
    };

    // Select the new referenced by node
    clearSelectedNode( tree, parentViewModel.filteredTree, parentViewModel.subPanelContext.context.searchState );
    newBackwardsReferenceNode.selected = true;
    let newSearchState = { ...parentViewModel.subPanelContext.context.searchState.getValue() };
    newSearchState.selectedNode = newBackwardsReferenceNode;
    parentViewModel.subPanelContext.context.searchState.update( newSearchState );

    nodeFromTree.children.unshift( newBackwardsReferenceNode );

    tree = await expandAction( tree, newBackwardsReferenceNode, parentViewModel.subPanelContext.workspaceObjectSubTypes );

    // Add the referenced by property to fitered tree
    let updatedReferencedByTree = [];
    if( referencedByNode.name === parentViewModel.tree[ 0 ].name ) {
        updatedReferencedByTree = parentViewModel.tree;
    }
    else {
        updatedReferencedByTree = [ getNodeByHierarchyString( tree, referencedByNode.hierarchyString ) ];
    }
    if( parentViewModel.typeOrAllProperties === 'typeProperties' ) {
        updatedReferencedByTree = filterTreeByTypeProperties( updatedReferencedByTree, updatedReferencedByTree, parentViewModel.searchBox.dbValue, 
                parentViewModel.typeOrAllProperties, parentViewModel.parentTypeProperties );
    }
    if( referencedByNode.name === parentViewModel.tree[ 0 ].name ) {
        parentViewModel.filteredTree[ 0 ].children.unshift( updatedReferencedByTree[ 0 ].children[ 0 ] );
    }
    else {
        assignChildTreeToParent( parentViewModel.filteredTree, updatedReferencedByTree, referencedByNode.hierarchyString );
    }
};

export let updateSubPanelContextForTypeSelectionPopupForReferencedBy = function( node, subPanelContext, viewModel ) {
    let selectTypeContext = { isReferencedBy: true, selectedNode: node, parentViewModel: viewModel, ...subPanelContext };
    let newSearchState = subPanelContext.context.searchState ? { ...subPanelContext.context.searchState.getValue() } : {};
    newSearchState.selectTypeContext = selectTypeContext;
    subPanelContext.context.searchState.update( newSearchState );
};

export let clearContextForTypeSelectionPanel = function( searchState ) {
    let newSearchState = { ...searchState.getValue() };
    delete newSearchState.selectTypeContext;
    searchState.update( newSearchState );
};

export let parseWorkspaceObjectSubTypes = function( response ) {
    const getSubTypes = function( tree ) {
        tree.forEach( function( child ) {
            workspaceObjectSubTypes.push( child.typeInternalName );
            if( child.subTypes && child.subTypes.length > 0 ) {
                getSubTypes( child.subTypes );
            }
        } );
    };

    let treeRoot = response.treeRootNodes;
    let workspaceObjectSubTypes = [];

    getSubTypes( treeRoot );
    return workspaceObjectSubTypes;
};

let isTypeSubTypeOfWorkspaceObject = function( type, workspaceObjectSubTypes ) {
    let typeModel = cmm.getType( type );

    if( !typeModel ) {
        return workspaceObjectSubTypes.includes( type );
    }

    return typeModel.typeHierarchyArray.includes( 'WorkspaceObject' );
};

export let setIsTypeSelectionCollapsed = function( eventData ) {
    return eventData.isCollapsed;
};

export let collapseTypeSection = function() {
    return true;
};

export let clearSelectedProperty = function() {
    return '';
};

export let removeNonSelectedTypesFromTree = function( tree ) {
    return [ tree[ 0 ] ];
};

export let filterOutLongStringPropTypes = ( tree ) => {
    if( tree?.length > 0 && tree[ 0 ]?.children?.length > 0  ) {
        // Children who have a valueType 8 (string) and maxLength 0 indicate it is a long string
        let filteredChildren = tree[ 0 ].children.filter( child => 
                ( child.valueType !== 8 || ( child.valueType === 8 && child.maxLength !== 0 ) ) );
    
        tree[ 0 ].children = filteredChildren;
    }
    return tree;
};

const AwSavedQueryAddClauseService = {
    renameKeys,
    expandRoot,
    updateTreeSelection,
    filterTreeByPropertyTypes,
    filterTreeByQuery,
    getNodeByHierarchyString,
    sortPropertiesByDisplayName,
    removeDuplicateProperties,
    expandAction,
    addDummyChildren,
    addDummyChildrenAfterFiltering,
    updateHierarchyString,
    assignChildTreeToParent,
    switchViewMode,
    switchTypeOrAllProperties,
    clearSelectedNode,
    parseParentTypeProperties,
    filterTreeByTypeProperties,
    updateSubPanelContextForTypeSelectionPopup,
    renameKeysForTypeHierarchyTree,
    updateSelectedType,
    confirmSelectTypeNonReferencedByProperty,
    filterTypesBySearchBox,
    expandAction2,
    getTypeSelectionPanelTitle,
    getAddClausePanelDisplayNameInternalNamePref,
    setAddClausePanelDisplayNameInternalNamePref,
    getAddClausePanelTypePropertyAllPropertyPref,
    setAddClausePanelTypePropertyAllPropertyPref,
    confirmSelectProperty,
    updateSubPanelContextForTypeSelectionPopupForReferencedBy,
    clearContextForTypeSelectionPanel,
    parseWorkspaceObjectSubTypes,
    setIsTypeSelectionCollapsed,
    collapseTypeSection,
    clearSelectedProperty,
    removeNonSelectedTypesFromTree,
    filterOutLongStringPropTypes
};

export default AwSavedQueryAddClauseService;
