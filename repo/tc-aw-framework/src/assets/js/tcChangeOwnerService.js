// Copyright (c) 2022 Siemens

/**
 * @module js/tcChangeOwnerService
 */
import adapterSvc from 'js/adapterService';
import _ from 'lodash';
import { getTypeIconURL } from 'js/iconService';
import cdm from 'soa/kernel/clientDataModel';
import soaService from 'soa/kernel/soaService';

var exports = {};

/**
 * Do the changeOwnership call to transfer the owner
 *
 * @param {data} data - The qualified data of the viewModel
 * @param {selectedObjects} selectedObjects - selected objects
 * @param {Object} dataProvider - The data provider that will be used to get the correct content
 *
 */
export let getChangeOwnerInput = function( data, selectedObjects, selectedUserObject ) {
    // Check if selectedUserObject is null or undefined then no need to process further
    // and return from here
    if( !selectedUserObject ) {
        return;
    }

    var objectsForChangeOwner = [];
    var soaInput = [];
    var groupCriteria = {};
    var objectCriteria = {};
    var ownerCriteria = {};
    var inputCriteria = {};


    for( let i = 0; i < selectedObjects.length; ++i ) {
        objectsForChangeOwner.push( selectedObjects[i] );
    }

    let objectsSelectedInTree = data.selectionData.selected;
    var objectsForChangeOwnerFromTree = [];

    if( objectsSelectedInTree ) {
        for( let i = 0; i < objectsSelectedInTree.length; ++i ) {
            let selectedObject = objectsSelectedInTree[i];
            selectedObject.type = objectsSelectedInTree[i].props.object_type.value;
            objectsForChangeOwnerFromTree.push( selectedObject );
        }
    }

    if( selectedUserObject && selectedUserObject.props && selectedUserObject.props.user ) {
        ownerCriteria = {
            uid: selectedUserObject.props.user.dbValues[ 0 ],
            type: 'User'
        };
    }

    if( selectedUserObject && selectedUserObject.props && selectedUserObject.props.group ) {
        groupCriteria = {
            uid: selectedUserObject.props.group.dbValues[ 0 ],
            type: 'Group'
        };
    }

    var adaptedObjects = [];
    adaptedObjects = adapterSvc.getAdaptedObjectsSync( objectsForChangeOwner );

    if( adaptedObjects && adaptedObjects.length > 0 ) {
        _.forEach( adaptedObjects, function( adaptedObject ) {
            if( adaptedObject && adaptedObject.uid && adaptedObject.type ) {
                objectCriteria = {
                    uid: adaptedObject.uid,
                    type: adaptedObject.type
                };
            }

            inputCriteria = {
                group: groupCriteria,
                object: objectCriteria,
                owner: ownerCriteria
            };

            soaInput.push( inputCriteria );
        } );
    }

    if( objectsForChangeOwnerFromTree && objectsForChangeOwnerFromTree.length > 0 ) {
        _.forEach( objectsForChangeOwnerFromTree, function( objectForChangeOwnerFromTree ) {
            if( objectForChangeOwnerFromTree && objectForChangeOwnerFromTree.uid && objectForChangeOwnerFromTree.type ) {
                objectCriteria = {
                    uid: objectForChangeOwnerFromTree.uid,
                    type: objectForChangeOwnerFromTree.type
                };
            }

            inputCriteria = {
                group: groupCriteria,
                object: objectCriteria,
                owner: ownerCriteria
            };

            soaInput.push( inputCriteria );
        } );
    }

    
    return soaInput;
};


export let getIncludeRelatedObjectsFlag = ( data ) => {
    let objectsSelectedInTree = data.selectionData.selected;
    if( objectsSelectedInTree && objectsSelectedInTree.length > 0 ) {
        return false;
    }
    return true;
};

export const showRelatedObjects = shouldShowRelatedObjects => {
    return shouldShowRelatedObjects && shouldShowRelatedObjects  === true ?  {
        showRelatedObjects: true,
        hideRelatedObjects: false
    } :  {
        showRelatedObjects: false,
        hideRelatedObjects: true
    };
};

export const loadRelatedObjectsData2 = async( data, subPanelContext ) => {
    let inputObjects = subPanelContext.selectionData.selected ? subPanelContext.selectionData.selected : subPanelContext.searchState.selectedModelObjects;
    let adaptedObjects = adapterSvc.getAdaptedObjectsSync( inputObjects );


    let adaptedObjectSet = [];

    if( adaptedObjects && adaptedObjects.length > 0 ) {
        _.forEach( adaptedObjects, function( adaptedObject ) {
            let obj = {
                uid: adaptedObject.uid,
                type: adaptedObject.type
            };
            adaptedObjectSet.push( obj );
        } );
    }

    let inputData = {
        inputObjects: adaptedObjectSet
    };
    return soaService.post( 'Core-2023-12-DataManagement', 'getRelatedObjects', inputData ).then( function( response ) {
        let outerObject = {};
        let parentChildMap = response.parentChildMap ? response.parentChildMap : {};

        let inputObjectUids = [];
        for( let i = 0; i < adaptedObjectSet.length; ++i ) {
            inputObjectUids.push( adaptedObjectSet[i].uid );
        }

        parentChildMap.topUid = inputObjectUids;


        let treeNodes = response.treeNodes;
        let parentKeys = Object.keys( parentChildMap );
        for( let key in parentKeys ) {
            let children = parentChildMap[ parentKeys[key] ];
            let childObjectsArr = [];
            for( let i = 0; i < children.length; ++i ) {
                let childObject = {};
                childObject.displayName = getDisplayName( treeNodes, children[i] );
                childObject.uid = children[i];
                childObject.isLeaf = getIsLeaf( treeNodes, children[i] );
                childObject.parentUid = parentKeys[key];
                if( childObject.parentUid === "topUid" ) {
                    childObject.isLeaf = false;
                }
                let propInfos = {};
                let propInfo = {};
                propInfo.name = 'object_name';
                propInfo.type = 'STRING';
                propInfo.value = getPropDbValue( children[i], 'object_name' );
                propInfo.value = propInfo.value ? propInfo.value : getPropDbValue( children[i], 'object_string' );
                propInfo.uiValue = getPropUiValue( children[i], 'object_name' );
                propInfo.uiValue = propInfo.uiValue ? propInfo.uiValue : getPropUiValue( children[i], 'object_string' );
                propInfos.object_name = propInfo;

                let propInfo1 = {};
                propInfo1.name = 'object_type';
                propInfo1.type = 'STRING';
                propInfo1.value = getTypeName( children[i] );
                propInfo1.uiValue = getTypeName( children[i] );

                propInfos.object_type = propInfo1;

                let propInfo2 = {};
                propInfo2.name = 'relation';
                propInfo2.type = 'STRING';
                propInfo2.value = getRelation( treeNodes, children[i] );
                propInfo2.uiValue = getRelation( treeNodes, children[i] );
                propInfos.relation = propInfo2;

                childObject.props = propInfos;

                childObjectsArr.push( childObject );
            }
            outerObject[parentKeys[key]] = childObjectsArr;
        }
        let responseToSend = {};
        responseToSend.data = outerObject;
        return responseToSend;
    } );
};

let getDisplayName = ( treeNodes, uid ) => {
    let displayName = '';
    for( let idx in treeNodes ) {
        if( treeNodes[idx].identifier === uid ) {
            displayName = treeNodes[idx].displayName;
        }
    }
    if( displayName === '' ) {
        let obj = cdm.getObject( uid );
        if( obj && obj.props && obj.props.object_name && obj.props.object_name.uiValues[0] ) {
            displayName = obj.props.object_name.uiValues[0];
        }
    }
    return displayName;
};

let getIsLeaf = ( treeNodes, uid ) => {
    for( let idx in treeNodes ) {
        if( treeNodes[idx].parentIdentifier === uid ) {
            return false;
        }
    }

    return true;
};

let getRelation = ( treeNodes, uid ) => {
    for( let idx in treeNodes ) {
        if( treeNodes[idx].identifier === uid ) {
            return treeNodes[idx].relationType;
        }
    }
    return '';
};

let getTypeName = ( uid ) => {
    let obj = cdm.getObject( uid );
    return obj.type;
};

let getPropDbValue = ( uid, propName ) => {
    let obj = cdm.getObject( uid );
    return obj.props[propName].dbValue ? obj.props[propName].dbValue : obj.props[propName].dbValues[ 0 ];
};

let getPropUiValue = ( uid, propName ) => {
    let obj = cdm.getObject( uid );
    return obj.props[propName].uiValue ? obj.props[propName].uiValue : obj.props[propName].uiValues[ 0 ];
};

export const loadChangeOwnerRelatedObjectsData = function( result, data, nodeBeingExpanded, subPanelContext ) {
    let inputObjects = subPanelContext.selectionData.selected ? subPanelContext.selectionData.selected : subPanelContext.searchState.selectedModelObjects;
    let adaptedObjects = adapterSvc.getAdaptedObjectsSync( inputObjects );
    let uidToLookup = '';
    if( _.isArray( nodeBeingExpanded ) ) {
        uidToLookup = nodeBeingExpanded[0].uid;
    } else if( _.isString( nodeBeingExpanded ) ) {
        uidToLookup = nodeBeingExpanded;
    } else if( nodeBeingExpanded ) {
        if( nodeBeingExpanded.id === 'top' ) {
            uidToLookup = adaptedObjects[0].uid;
            uidToLookup = 'topUid';
        } else {
            uidToLookup = nodeBeingExpanded.uid;
        }
    } else {
        uidToLookup = adaptedObjects[0].uid;
        uidToLookup = 'topUid';
    }

    let response = result.data[ uidToLookup ];

    _.forEach( response, function( treeNode ) {
        treeNode.id = treeNode.uid ? treeNode.uid : treeNode.displayName;
        treeNode.levelNdx = nodeBeingExpanded ?  nodeBeingExpanded.levelNdx + 1  : 0;
        let typeIcon = getTypeIconURL( treeNode.props.object_type.value );
        treeNode.typeIconURL = typeIcon ? typeIcon : getTypeIconURL( 'Tracelink' );
    } );


    return {
        parentNode: nodeBeingExpanded,
        childNodes: response,
        totalChildCount: response ? response.length : 0,
        startChildNdx: 0
    };
};

export const initialize = selectedObjects => {
    let selObjects = '';
    for( const obj of selectedObjects ) {
        selObjects += obj.props.object_string.uiValue + '\n';
    }
    return selObjects;
};

export const updateNewChangeOwner = newOwner => {
    return newOwner ? newOwner.cellHeader1 : '';
};

export const cacheSelections = selection => {
    return selection && selection.selected;
};

export const updateSelectedObj = subPanelContext => {
    return subPanelContext.selectionData.selected ? subPanelContext.selectionData.selected : subPanelContext.searchState.selectedModelObjects;
};

export const hasSelectionChanged = ( selection, cachedSelection ) => {
    if( selection.selected && cachedSelection ) {
        if ( selection.selected.length !== cachedSelection.length || !_.isEqual( selection.selected, cachedSelection ) ) {
            return true;
        }
    }
};

export const selectTreeNodes = ( dataProvider ) => {
    dataProvider.selectAll();
};

export const setNumberOfSuccessfulObjects = ( selected, partialErrors ) => {
    let countOfSuccessFulObjects = 0;
    let failedUids = [];
    for( let i = 0; i < partialErrors.length; ++i ) {
        failedUids.push( partialErrors[i].uid );
    }

    var adaptedObjects = [];
    adaptedObjects = adapterSvc.getAdaptedObjectsSync( selected );

    for( let j = 0; j < adaptedObjects.length; ++j ) {
        if( !failedUids.includes( adaptedObjects[j].uid ) ) {
            countOfSuccessFulObjects++;
        }
    }
   
    return countOfSuccessFulObjects;
};

export default exports = {
    getChangeOwnerInput,
    getIncludeRelatedObjectsFlag,
    showRelatedObjects,
    loadChangeOwnerRelatedObjectsData,
    initialize,
    updateNewChangeOwner,
    cacheSelections,
    hasSelectionChanged,
    loadRelatedObjectsData2,
    updateSelectedObj,
    selectTreeNodes,
    setNumberOfSuccessfulObjects
};
