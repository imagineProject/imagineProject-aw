// Copyright (c) 2024 Siemens

/**
 * @module js/aceOccurrenceSubstituteGroupService
 *
 */

import aceBackingObjectProviderService from 'js/aceBackingObjectProviderService';
import addObjectUtils from 'js/addObjectUtils';
import appCtxService from 'js/appCtxService';
import awPromiseService from 'js/awPromiseService';
import awColumnSvc from 'js/awColumnService';
import awTableTreeSvc from 'js/splmTablePublishedTreeService';
import cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import iconSvc from 'js/iconService';
import localeService from 'js/localeService';
import occmgmtGetSvc from 'js/aceGetService';
import occmgmtUtils from 'js/occmgmtUtils';
import tcDataMgmtService from 'js/tcDataManagementService';
import tcVmoService from 'js/tcViewModelObjectService';
import showMarkupSvc from 'js/showMarkupService';
import soaSvc from 'soa/kernel/soaService';
import viewModelObjectService from 'js/viewModelObjectService';
import _ from 'lodash';
import _uwPropSrv from 'js/uwPropertyService';

import viewModelObjectSvc from 'js/viewModelObjectService';

let exports = {};

const Folder = 'Folder';
const clientScopeURI = 'awb0OccSubstituteGroup';
const OccurrenceSubstituteGroup = 'Fnd0OccSubstGroup';
const SubstituteCategory_OccSubstituteGroup = 'OccSubstituteGroup';
const SubstituteCategory_SubstituteOccurrences = 'SubstituteOccurrences';
const SubstituteCategory_SubLinesFromSubGrpSet = 'SubstituteLinesFromSubsituteGroupSet';
const SubstituteCategory_ElementUnderSG = 'ElementUnderSubstituteGroup';
const SubstituteCategory_ElementFolderUnderOccSG = 'ElementFolderUnderOccSubstituteGroup';
const SubstituteCategory_SubstituteSetUnderOccSG = 'SubsituteGroupSetUnderOccSubstituteGroup';
const ItemBasedSubstitute = 'ItemBased_Substitute';
const OccBasedSubstitutePrimary = 'OccBasedSubstitute_primary';
const OccBasedSubstituteSubstitute = 'OccBasedSubstitute_substitute';
const SubstituteCategory_RemovedOccurrences = 'RemovedOccurrences';

const ItemBased_Substitute = 1 << 0;                // Bit 0 (int value = 1)
const OccBasedSubstitute_primary = 1 << 1;          // Bit 2 (int value = 2)
const OccBasedSubstitute_substitute = 1 << 2;       // Bit 3 (int value = 4)

let IModelObject = function( uid, type ) {
    this.uid = uid;
    this.type = type;
};

/**
 * @internal
 *  It returns the string (comma seperated values) with existing set Ids for SOA usecase - performSearchViewModel (usecase :GenerateSetID)
 *  e.g  existingSetIds :{1,2}
 * @param {Object} substituteSetsInfo  Information of all existing sets
 * @returns {String} returns existingSetIds
 */
export let getExistingSetsAsInput = function( substituteSetsInfo ) {
    let existingSetIds = '';

    if ( substituteSetsInfo.setInfoSectionObject ) {
        _.forEach( substituteSetsInfo.setInfoSectionObject, function( setInfoSectionObject ) {
            existingSetIds = existingSetIds.concat( ',', setInfoSectionObject.setId );
        } );
    }
    //remove first leading comma
    var expression = /^,+/;

    existingSetIds = existingSetIds.replace( expression, '' );
    return existingSetIds;
};

/**
 * @internal
 * It populates setInfoSectionObject objects with modelObjects and Set Id
 *  *
 * @param {Object} substituteSetsInfo  Information of a set
 * @param {String} nextSetId Generated set id from soa
 * @returns {Object} returns updated substituteSetsInfo
 */
export let getSubstituteSetInfo = function( substituteSetsInfo, nextSetId ) {
    if( substituteSetsInfo.setInfoSectionObject ) {
        substituteSetsInfo.setInfoSectionObject.push( {
            setId : nextSetId,
            substituteBOMLines : []
        } );
        return substituteSetsInfo;
    }

    let setInfoSectionObject = [];
    setInfoSectionObject.push( {
        setId : nextSetId,
        substituteBOMLines : []
    } );
    substituteSetsInfo.setInfoSectionObject = setInfoSectionObject;
    return substituteSetsInfo;
};

/**
 * @internal
 * This updates the generated set value of particular set, so coming back from add panel we can update modelObjects for that set
 * And also updates set value on state when we user manually change set value
 *
 * @param {Object} substituteSetSectionInfo particular set section info
 * @param {Object} addPanelState panel State
 * @param {String} substituteSetId field of panel
 */
export let updateGeneratedsetIdOnState = function( substituteSetSectionInfo, addPanelState, substituteSetId ) {
    if( substituteSetSectionInfo.setId !== substituteSetId ) {
        substituteSetSectionInfo.setId = substituteSetId;
    }
    let localContext = { ...addPanelState.value };
    localContext.setId = substituteSetSectionInfo.setId;
    addPanelState.update && addPanelState.update( localContext );
};

/**
 * @internal
 * This fundtion updates list providers with modelObjects, to list out bomlines for sets
 *
 * @param {Object} substituteSetSectionInfo particular set section info
 * @param {Object} addPanelState panel State
 * @param {Object} substituteSetsInfo all sets Info state
 * @param {Object}  dataProvider List provider
 */
export let updateListWithBomline = function( substituteSetSectionInfo, addPanelState, substituteSetsInfo, dataProvider ) {
    let localContext = { ... substituteSetsInfo.value };
    if ( substituteSetsInfo.setInfoSectionObject && substituteSetsInfo.setInfoSectionObject.length > 0 ) {
        const setInfoSectionObject = _.find( localContext.setInfoSectionObject, function( section ) {
            return section.setId === addPanelState.setId;
        } );

        if( setInfoSectionObject ) {
            let substituteBOMLines = setInfoSectionObject.substituteBOMLines;
            _.forEach( addPanelState.sourceObjects, function( object ) {
                substituteBOMLines.push( object );
            } );
            setInfoSectionObject.substituteBOMLines = _.uniq(  setInfoSectionObject.substituteBOMLines );
            substituteSetsInfo.update && substituteSetsInfo.update( localContext );
        }
        dataProvider.update( substituteSetSectionInfo.substituteBOMLines, substituteSetSectionInfo.substituteBOMLines.length );
    }
};

/**
 * @internal
 * This function updates the addPanelState with selectedObjects(after coming from substitutes tab) and also returns that object
 *
 * @param {Object} selectedObjects selected Obejct
 * @param {Object} addPanelState panel State

 * @returns {object} returns selectedObjects
 */
export let updateSelectedObjectsOnState = function( selectedObjects, addPanelState ) {
    if( addPanelState ) {
        let newAddPanelState = { ...addPanelState.getValue() };
        if( selectedObjects.length > 0 ) {
            newAddPanelState.sourceObjects = selectedObjects;
        } else {
            newAddPanelState.sourceObjects = null;
        }
        addPanelState.update( newAddPanelState );
    }

    return selectedObjects;
};
/**
 * @internal
 * This function updates the addPanelState with selectedObjects(after coming from add panel) and also returns that object
 *
 * @param {Object} createdObject selected Obejct
 * @param {Object} data data
 * @returns {object} returns addPanelState
 */

export let updateCreatedObjectsOnState = function( createdObject, data ) {
    if( data.addPanelState ) {
        let newAddPanelState = data.addPanelState;
        if( Array.isArray( createdObject ) ) {
            newAddPanelState.sourceObjects = createdObject;
        } else {
            let createdObj = [];
            createdObj.push( createdObject );
            newAddPanelState.sourceObjects = createdObj;
        }
        return { ...newAddPanelState };
    }
};

/**
 * @internal
 * Get name of created Occurrence Substitute Group Name from soa output - > createObjects
 *
 * @param {Object} response SOA response
 * @return {String} name of
 */
export let getCreatedOccSGObjectName = function( response ) {
    let OccSubstituteGroupUid = response.substituteGroupObjects[0].substituteGroup.uid;
    if( response.ServiceData.modelObjects[OccSubstituteGroupUid] ) {
        return response.ServiceData.modelObjects[OccSubstituteGroupUid].props.object_string.dbValues[0];
    }
};

/*
    Below function calls getElementsForIds SOA to fetch Awb0DesignElements for the given BOMLines.
    From the Awb0DesignElement we load markup properties on the corresponding BOMLine.
    These markup properties will be used to populate redlining information on the VMTN.
*/
let _populateMarkupPropertiesOnBOMLines = function( treeLoadInput, i18n, fetchSoaResponse, subPanelContext, deferred, columnConfig, isOneToOne, substituteGroupDataProvider ) {
    let bomLineUids = [];

    // Collect all Primary and Substitute BOMLines
    for( let i = 0; i < fetchSoaResponse.substituteGroupInfoOut[0].substituteGroupInfo.length; i++ ) {
        let occurrenceSubstituteGroupObject = fetchSoaResponse.substituteGroupInfoOut[0].substituteGroupInfo[i];
        if( occurrenceSubstituteGroupObject.substituteSets && occurrenceSubstituteGroupObject.substituteSets.length > 0 ) {
            for( let j = 0; j < occurrenceSubstituteGroupObject.substituteSets.length; j++ ) {
                let substituteSet = occurrenceSubstituteGroupObject.substituteSets[j];
                if( substituteSet.substituteLines && substituteSet.substituteLines.length > 0 ) {
                    for( let k = 0; k < substituteSet.substituteLines.length; k++ ) {
                        let substituteLine = substituteSet.substituteLines[k];
                        bomLineUids.push( substituteLine.uid );
                    }
                }
            }
        }

        if( occurrenceSubstituteGroupObject.primaryBOMLines && occurrenceSubstituteGroupObject.primaryBOMLines.length > 0 ) {
            for( let j = 0; j < occurrenceSubstituteGroupObject.primaryBOMLines.length; j++ ) {
                let primaryBOMLine = occurrenceSubstituteGroupObject.primaryBOMLines[j];
                bomLineUids.push( primaryBOMLine.uid );
            }
        }
    }

    let elementsIn = {
        typeOfElementUids: 'SR_UID',
        elementUids: bomLineUids,
        productContext: subPanelContext.context.occContext.productContextInfo
    };
    let propertyPolicyOverride = {
        types: [ {
            name: 'Awb0ConditionalElement',
            properties: [
                {
                    name: 'awb0MarkupPropertyNames',
                    modifiers: [ {
                        name: 'excludeUiValues',
                        Value: 'true'
                    } ]
                },
                {
                    name: 'awb0MarkupPropertyValues'
                },
                {
                    name: 'awb0MarkupType',
                    modifiers: [ {
                        name: 'excludeUiValues',
                        Value: 'true'
                    } ]
                }
            ]
        } ]
    };

    // Call getElementsForIds SOA to fetch Markup properties for given BOMLines
    if( fetchSoaResponse.substituteGroupInfoOut ) {
        soaSvc.postUnchecked( 'Internal-ActiveWorkspaceBom-2022-06-OccurrenceManagement', 'getElementsForIds', { //$NON-NLS-1$
            elementsIn: elementsIn
        }, propertyPolicyOverride ).then( function( response ) {
            if ( response ) {
                let modelObjects = response.ServiceData.modelObjects;
                let bomlineObjs = aceBackingObjectProviderService.getBackingObjectsSync( Object.values( modelObjects ) );

                let uidToObjectMap = {};

                // Initialize a BOMLine to Element map
                for( let ind in bomlineObjs ) {
                    uidToObjectMap[ bomlineObjs[ind].uid ] = Object.values( modelObjects )[ind];
                }

                for( let i = 0; i < fetchSoaResponse.substituteGroupInfoOut[0].substituteGroupInfo.length; i++ ) {
                    let occurrenceSubstituteGroupObject = fetchSoaResponse.substituteGroupInfoOut[0].substituteGroupInfo[i];
                    if( occurrenceSubstituteGroupObject.substituteSets && occurrenceSubstituteGroupObject.substituteSets.length > 0 ) {
                        for( let j = 0; j < occurrenceSubstituteGroupObject.substituteSets.length; j++ ) {
                            let substituteSet = occurrenceSubstituteGroupObject.substituteSets[j];
                            if( substituteSet.substituteLines && substituteSet.substituteLines.length > 0 ) {
                                for( let k = 0; k < substituteSet.substituteLines.length; k++ ) {
                                    let substituteLine = substituteSet.substituteLines[k];
                                    let occObj = uidToObjectMap[substituteLine.uid];
                                    let markupProps = {
                                        awb0MarkupPropertyNames: occObj.props.awb0MarkupPropertyNames,
                                        awb0MarkupPropertyValues: occObj.props.awb0MarkupPropertyValues,
                                        awb0MarkupType: occObj.props.awb0MarkupType
                                    };
                                    Object.assign( substituteLine.props, markupProps );
                                }
                            }
                        }
                    }

                    if( occurrenceSubstituteGroupObject.primaryBOMLines && occurrenceSubstituteGroupObject.primaryBOMLines.length > 0 ) {
                        for( let j = 0; j < occurrenceSubstituteGroupObject.primaryBOMLines.length; j++ ) {
                            let primaryBOMLine = occurrenceSubstituteGroupObject.primaryBOMLines[j];
                            let occObj = uidToObjectMap[primaryBOMLine.uid];
                            let markupProps = {
                                awb0MarkupPropertyNames: occObj.props.awb0MarkupPropertyNames,
                                awb0MarkupPropertyValues: occObj.props.awb0MarkupPropertyValues,
                                awb0MarkupType: occObj.props.awb0MarkupType
                            };
                            Object.assign( primaryBOMLine.props, markupProps );
                        }
                    }
                }

                if( !isOneToOne ) {
                    buildNextTreeTableStructure( treeLoadInput, i18n, fetchSoaResponse, deferred );
                    substituteGroupDataProvider.json.contextMenuCommandsAnchor = 'aw_occSubstGroupSection';
                } else {
                    let vmNodes = _buildSubstituteOccurrenceTreeForOneToOne( fetchSoaResponse.substituteGroupInfoOut[0].substituteGroupInfo[0], treeLoadInput );
                    substitutesBuildTreeLoadResult( fetchSoaResponse, treeLoadInput, vmNodes, true, true, columnConfig, 'true', deferred );
                }
            }
        } );
    }
};


/**
 * @internal
 * Get substitute group data for the next action. This will be called when the Elements Node under the SubstituteGroup is expanded
 * @param {Object} treeLoadInput Tree Load Input
 * @param {Object} i18n i18n
 * @param {Object} fetchSoaResponse SOA response
 * @return {Promise} Resolved with an object containing the results of the operation.
 */
export let loadNextOccSubstituteGroupTree = function( treeLoadInput, i18n, fetchSoaResponse, subPanelContext ) {
    let deferred = awPromiseService.instance.defer();
    let isRedLineMode = appCtxService.getCtx( 'isRedLineMode' );
    if( isRedLineMode === 'true'  ) {
        _populateMarkupPropertiesOnBOMLines( treeLoadInput, i18n, fetchSoaResponse, subPanelContext, deferred, null, false );
    } else {
        buildNextTreeTableStructure( treeLoadInput, i18n, fetchSoaResponse, deferred );
    }
    return deferred.promise;
};

/**
 * Calls PerformSearch SOA to build occurrence substitute group tree nodes.
 *
 * e.g  This function builds this structure
 *  - OccSubstGroup1            (if parentNode is instance of Fnd0OccSubstGroup, it will create Elements)
 *       Elements               (if parentNode type == Elements, it will build below structure)
 *          - Child1
 *      - Substitute Set ID : 1 (if parentNode type == Substitute Set ID, it will build below structure)
 *          - Sub1
 *      - Substitute Set ID : 2 (if parentNode type == Substitute Set ID, it will build below structure)
 *          - Sub2
 * @param {Object} treeLoadInput Tree Load Input
 * @param {Object} i18n i18n
 * @param {Object} fetchSoaResponse SOA response
 * @param {Object} deferred defferedbject
 */
function buildNextTreeTableStructure( treeLoadInput, i18n, fetchSoaResponse, deferred ) {
    // e.g  For below if block it created below structure
    // - OccSubstGroup1            (if parentNode is instance of Fnd0OccSubstGroup, it will create below nodes which are not expanded)
    //       - Elements
    //       - Substitute Set ID : 1
    //       - Substitute Set ID : 2
    if ( treeLoadInput.parentNode.type === OccurrenceSubstituteGroup ) {
        let startReached = true; //true if the first page of the results has been reached.
        let endReached = true; //true if the last page of the results has been reached.
        let vmNodes = [];

        //Creates Element folder uid appending parent uid(we can append anything).
        //This is unique id while creating tree node
        let elementsUid = i18n.Elements + treeLoadInput.parentNode.uid;

        let treeVmNodeElement = createViewModelNode( treeLoadInput, elementsUid, i18n.Elements, SubstituteCategory_ElementFolderUnderOccSG );
        vmNodes.push( treeVmNodeElement );

        let substituteGroup = treeLoadInput.parentNode.uid;
        if( fetchSoaResponse.substituteGroupInfoOut.length > 0 ) {
            _.forEach( fetchSoaResponse.substituteGroupInfoOut[0].substituteGroupInfo, function( occurrenceSubstituteGroupObject ) {
                if( substituteGroup === occurrenceSubstituteGroupObject.substituteGroup.uid  ) {
                    _.forEach( occurrenceSubstituteGroupObject.substituteSets, function( substituteSet ) {
                        let fnd0setIdObj = cdm.getObject( substituteSet.groupSet.uid );

                        //Generate Folder name : e.g Substitute Set ID: 1 (1 is the display value of set)
                        let setName = i18n.substituteSetId;
                        setName = setName.replace( '{0}', fnd0setIdObj.props.object_string.dbValues[0] );

                        //Creates Substitute Set ID folder uid appending parent uid(we can append anything)
                        //This is unique id while creating tree node
                        let setUid = setName + treeLoadInput.parentNode.uid;
                        let treeVmNodeSets = createViewModelNode( treeLoadInput, setUid, setName, SubstituteCategory_SubstituteSetUnderOccSG, substituteSet.groupSet );
                        vmNodes.push( treeVmNodeSets );
                    } );
                    let treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, vmNodes, true, startReached, endReached, null );
                    deferred.resolve( {
                        treeLoadResult: treeLoadResult
                    } );
                }
            } );
        }
    }

    // e.g Expand Elements folder, it will get primary elements
    // - OccSubstGroup1
    //       - Elements
    //           - child1
    //           - child2
    //       - Substitute Set ID : 1
    //       - Substitute Set ID : 2
    else if ( treeLoadInput.parentNode.type === i18n.Elements ) {
        // When we expand Elements folder, it will get primary elements
        let substituteGroup = treeLoadInput.parentNode.fnd0OccSubstGroupObj.uid;
        let vmNodes = [];

        _.forEach( fetchSoaResponse.substituteGroupInfoOut[0].substituteGroupInfo, function( occurrenceSubstituteGroupObject ) {
            if( substituteGroup === occurrenceSubstituteGroupObject.substituteGroup.uid  ) {
                _.forEach( occurrenceSubstituteGroupObject.primaryBOMLines, function( primaryBOMLine, childNdx ) {
                    let primaryBOMLineObj = cdm.getObject( primaryBOMLine.uid );
                    let isRedLineMode = appCtxService.getCtx( 'isRedLineMode' );
                    if( isRedLineMode === 'true' ) {
                        // Below call will create a VMO and call populateMarkupValues() function from showMarkupService.js
                        // This function will populate the required redlining information on the VMO.
                        primaryBOMLineObj = viewModelObjectService.constructViewModelObjectFromModelObject( primaryBOMLineObj, 'EDIT' );
                    }
                    let iconURL = iconSvc.getTypeIconURL( primaryBOMLine.type );
                    let treeVmNode = awTableTreeSvc.createViewModelTreeNode( primaryBOMLineObj.uid, primaryBOMLineObj.type,
                        primaryBOMLineObj.props.object_string.uiValues[0], treeLoadInput.parentNode.levelNdx + 1, childNdx, iconURL );
                    treeVmNode.id += treeLoadInput.parentNode.id;
                    treeVmNode.alternateID = treeVmNode.id;
                    treeVmNode.isLeaf = true;
                    treeVmNode.fnd0OccSubstGroupObj = treeLoadInput.parentNode.fnd0OccSubstGroupObj;
                    treeVmNode.substituteCategory = SubstituteCategory_ElementUnderSG;
                    tcVmoService.mergeObjects( treeVmNode, primaryBOMLineObj );
                    vmNodes.push( treeVmNode );
                } );

                let treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, vmNodes, true, true, true, null );
                deferred.resolve( {
                    treeLoadResult: treeLoadResult
                } );
            }
        } );
    }
    // e.g  Expand Substitute Set ID :1 folder, it will get substitute elements for that specific set
    // - OccSubstGroup1
    //       - Elements
    //       - Substitute Set ID : 1
    //           - Sub1
    //       - Substitute Set ID : 2
    else if ( treeLoadInput.parentNode.type.includes( i18n.substituteSetIdLabel ) ) {
        // When we expand Substitute Set ID: * folder, it will get substitute elements
        let selectedSubstituteGroup = treeLoadInput.parentNode.fnd0OccSubstGroupObj.uid;
        let vmNodes = [];
        let selectedSubstituteSetUid = treeLoadInput.parentNode.fnd0setId.uid;
        _.forEach( fetchSoaResponse.substituteGroupInfoOut[0].substituteGroupInfo, function( occurrenceSubstituteGroupObject ) {
            if( selectedSubstituteGroup === occurrenceSubstituteGroupObject.substituteGroup.uid  ) {
                _.forEach( occurrenceSubstituteGroupObject.substituteSets, function( substituteSet ) {
                    if( selectedSubstituteSetUid === substituteSet.groupSet.uid ) {
                        _.forEach( substituteSet.substituteLines, function( substituteLine, childNdx ) {
                            let substituteBOMLineObj = cdm.getObject( substituteLine.uid );
                            let isRedLineMode = appCtxService.getCtx( 'isRedLineMode' );
                            if( isRedLineMode === 'true'  ) {
                                // Below call will create a VMO and call populateMarkupValues() function from showMarkupService.js
                                // This function will populate the required redlining information on the VMO.
                                substituteBOMLineObj = viewModelObjectService.constructViewModelObjectFromModelObject( substituteBOMLineObj, 'EDIT' );
                            }

                            let iconURL = iconSvc.getTypeIconURL( substituteLine.type );


                            let localTextBundle = localeService.getLoadedText( 'OccurrenceManagementConstants' );
                            let vmoProp = _uwPropSrv.createViewModelProperty( 'awb0SubstituteMapping', localTextBundle.mappingColumnName, 'STRING', '', [ ] );
                            vmoProp.isPropertyModifiable = false;
                            substituteBOMLineObj.props.awb0SubstituteMapping = vmoProp;

                            let treeVmNode = awTableTreeSvc.createViewModelTreeNode( substituteBOMLineObj.uid, substituteBOMLineObj.type,
                                substituteBOMLineObj.props.object_string.uiValues[0], treeLoadInput.parentNode.levelNdx + 1, childNdx, iconURL );
                            treeVmNode.id += treeLoadInput.parentNode.id;
                            treeVmNode.alternateID = treeVmNode.id;
                            treeVmNode.isLeaf = true;
                            treeVmNode.fnd0OccSubstGroupObj = treeLoadInput.parentNode.fnd0OccSubstGroupObj;
                            treeVmNode.fnd0setId = treeLoadInput.parentNode.fnd0setId;
                            treeVmNode.substituteCategory = SubstituteCategory_SubLinesFromSubGrpSet;
                            tcVmoService.mergeObjects( treeVmNode, substituteBOMLineObj );
                            vmNodes.push( treeVmNode );
                        } );
                    }
                } );
                vmNodes = populateSubstituteGroupMapping( occurrenceSubstituteGroupObject, vmNodes );

                let treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, vmNodes, true, true, true, null );
                deferred.resolve( {
                    treeLoadResult: treeLoadResult
                } );
            }
        } );
    }
}

/**
 * Create VM node based on input
 * @param {Object} treeLoadInput Tree Load Input
 * @param {String} objectUid uid of folder
 * @param {String} displayName display name of folder
 * @param {Object} fnd0setId set id
 * @return {treeVmNode} created vmNode
 */
function createViewModelNode( treeLoadInput, objectUid, displayName, substituteCategory, fnd0setId ) {
    let modelObject = new IModelObject( objectUid, 'unknownType' );
    let childNdx = 1;
    let iconURL = iconSvc.getTypeIconURL( Folder );
    let treeVmNode = awTableTreeSvc.createViewModelTreeNode( modelObject.uid, displayName, displayName, treeLoadInput.parentNode.levelNdx + 1, childNdx, iconURL );
    treeVmNode.props = {
        object_string: {
            uiValues: [ displayName ]
        }

    };
    treeVmNode.id = treeVmNode.id + treeLoadInput.parentNode.id + childNdx + treeLoadInput.parentNode.levelNdx;
    let modelParentObj = cdm.getObject( treeLoadInput.parentNode.uid );
    treeVmNode.parentNode = modelParentObj;
    treeVmNode.fnd0OccSubstGroupObj = modelParentObj;
    treeVmNode.fnd0setId = fnd0setId;
    treeVmNode.substituteCategory = substituteCategory;
    treeVmNode.isLeaf = false;
    return treeVmNode;
}

/**
 * Populate mapping column information on specific node
 * @param {Object} occurrenceSubstituteGroupObject occurrence substitute group
 * @param {Object} vmNodes created nodes
 * @return {vmNodes} vmNodes with mapping property
 */
function populateSubstituteGroupMapping( occurrenceSubstituteGroupObject, vmNodes ) {
    _.forEach( occurrenceSubstituteGroupObject.primaryToSubstituteMapping, function( primaryToSubstituteMapping ) {
        _.forEach( vmNodes, function( vmNode ) {
            if( vmNode.fnd0setId.uid === primaryToSubstituteMapping.substituteGroupSet.uid
                && vmNode.uid === primaryToSubstituteMapping.substituteBOMLines[0].uid ) {
                let mappingObjectsString = '';
                let mappingObjects = [];
                _.forEach( primaryToSubstituteMapping.primaryBOMLines, function( primaryBOMLine ) {
                    mappingObjects.push( primaryBOMLine.props.object_string.uiValues[0] );
                } );
                mappingObjectsString = mappingObjects.join( ',' );
                vmNode.props.awb0SubstituteMapping.uiValue = mappingObjectsString;
                vmNode.props.awb0SubstituteMapping.dbValue = mappingObjectsString;
            }
        } );
    } );
    return vmNodes;
}

/**
 * Populates soaInput based on input values
 * @param {Object} substituteGroup Tree Load Input
 * @param {String} selectedElement to create folder
 * @param {String} usecase usecase
 * @return {soaInput} soa input
 */
function populateSoaInput( substituteGroup, selectedElement, usecase ) {
    return {
        columnConfigInput: {
            clientName: 'AWClient',
            clientScopeURI: clientScopeURI
        },
        inflateProperties: true,
        searchInput: {
            maxToLoad: 500,
            maxToReturn: 500,
            providerName: 'Awb0SubstitutesProvider',
            searchFilterMap6: {},
            searchCriteria: {
                selectedElement: selectedElement,
                substituteGroup: substituteGroup,
                usecase: usecase
            },
            searchFilterFieldSortType: 'Alphabetical'
        }
    };
}

/**
 * @internal
 * Reads allowedPSOccurrenceTypes from addElementState and update occTypeVmProp on extensionVMProps
 * @param {Object} newAddElementState Tree Load Input
 * @return {newAddElementState} updated addElementState
 */
export let setSubstituteElementTypeOnUpdate = ( newAddElementState ) => {
    if( newAddElementState.extensionVMProps ) {
        return;
    }
    let substituteElementTypeDbValue = newAddElementState.allowedPSOccurrenceTypes[0].uid;
    let occTypeVMProp = _uwPropSrv.createViewModelProperty( 'occ_type', 'Occurrence Type', 'OBJECT', substituteElementTypeDbValue, '' );
    occTypeVMProp.value = newAddElementState.allowedPSOccurrenceTypes[0].uid;
    occTypeVMProp.dbValue = newAddElementState.allowedPSOccurrenceTypes[0].uid;
    occTypeVMProp.dbValues = [ newAddElementState.allowedPSOccurrenceTypes[0].uid ];
    occTypeVMProp.valueUpdated = true;
    newAddElementState.extensionVMProps = {
        occ_type: occTypeVMProp
    };
    return newAddElementState;
};


/**
  * @internal
  * Populate Occurrence Substitute Group Name on panel launch
  * @param {Object} selectedElement selected element
  * @param {String} createType The object type being created
  * @param {String} xrtType Create/saveAs
  * @param {Object} editHandler editHandleroccContext
 */
export let prePopulateOccSubstGrpNameField = ( selectedElement, createType, xrtType, editHandler ) => {
    let soaInput = populateSoaInput( '', selectedElement, 'GenerateSubstituteGroupName' );
    tcDataMgmtService.basePerformSearchViewModel( soaInput ).then(
        function( response ) {
            let updatedProps = [];
            let objectName = response.additionalSearchInfoMap.additionalInfoMessages[0];

            let editableProperties = addObjectUtils.getObjCreateEditableProperties( createType, xrtType, [ 'object_name' ], editHandler );
            if( editableProperties.object_name ) {
                let object_name =  { ...editableProperties.object_name };
                object_name.dbValue = objectName;
                object_name.value = objectName;
                object_name.isRequired = true;
                object_name.valueUpdated = true;
                updatedProps.push( object_name );
            }
            addObjectUtils.assignInitialValues( updatedProps, createType, editHandler );
        } );
};

/**
 * @internal
 * Get the previous selected UID object
 * @param {Object} pwaSelection pwa selection Object.
 * @return {Object} It returns the previous selected UID and Previous selection length.
 */
export let updatePreviousSelectedUid = ( pwaSelection ) => {
    return {
        previousSelectedUid: pwaSelection[0].uid,
        previousSelectionLength: pwaSelection.length
    };
};

/**
 * @internal
 * Get substitute set ID for selected substitute elements
 * @param {Object} selectionData SWA selection.
 * @return {Object} It returns selected substitute group set information.
 */
export let getSubstituteSetID = function( selectionData ) {
    let setID;
    let primaryBOMLines = [];
    let substituteBOMLines = [];

    _.forEach( selectionData.selected, function( selectedObject ) {
        if( selectedObject.substituteCategory === 'SubstituteLinesFromSubsituteGroupSet' ) {
            setID = selectedObject.fnd0setId;
            substituteBOMLines.push( selectedObject );
        } else{
            primaryBOMLines.push( selectedObject );
        }
    } );

    return [ {
        substituteGroupSet : setID,
        substituteBOMLines : substituteBOMLines,
        primaryBOMLines : primaryBOMLines
    } ];
};

/**
 * @internal
 * Get input data for create Occurrence Substitute Group Sets creation SOA
 *
 * @param {Object} newlyAddedChildElements - newly created substitute elements
 * @param {Object} substituteSetsInfo - Substitute Set Information
 * @return {Object} setInfoSectionObject
 */
export let getInputForSubstituteGroupSets = function( newlyAddedChildElements, substituteSetsInfo ) {
    _.forEach( substituteSetsInfo.setInfoSectionObject, function( setInfoObject ) {
        _.forEach( setInfoObject.substituteBOMLines, function( modelObject ) {
            if( modelObject.modelType.typeHierarchyArray.indexOf( 'ItemRevision' ) > -1 ) {
                _.forEach( newlyAddedChildElements, function( element ) {
                    if( modelObject.uid === element.props.awb0UnderlyingObject.dbValues[0] ) {
                        let bomlineObj = aceBackingObjectProviderService.getBackingObjectsSync( [ element ] );
                        modelObject.type = bomlineObj[0].type;
                        modelObject.uid = bomlineObj[0].uid;
                    }
                } );
            } else{
                let bomlineObj = aceBackingObjectProviderService.getBackingObjectsSync( [ modelObject ] );
                modelObject.type = bomlineObj[0].type;
                modelObject.uid = bomlineObj[0].uid;
            }
        } );
    } );
    return substituteSetsInfo.setInfoSectionObject;
};

/**
 * @internal
 * Get substitute elements to add
 *
 * @param {Object} substituteSetsInfo - Substitute Set Information
 * @return {Object} elementstoAdd
 */
export let getAddElementInput = function( substituteSetsInfo ) {
    let elementstoAdd = [];
    _.forEach( substituteSetsInfo.setInfoSectionObject, function( setInfoObject ) {
        _.forEach( setInfoObject.substituteBOMLines, function( modelObject ) {
            if( modelObject.modelType.typeHierarchyArray.indexOf( 'ItemRevision' ) > -1 ) {
                elementstoAdd.push( modelObject );
            }
        } );
    } );
    return elementstoAdd;
};

/**
* Get Occurrence substitute group data for the selected element.
* @internal
* @param {Object} treeLoadInput Tree Load Input
* @param {Object} columnConfig Column configuartion
* @param {Object} subPanelContext subPanelContext
* @return {Promise} Returns promise
*/
export let loadOccurrenceSubstituteGroupTree = function( treeLoadInput, columnConfig, subPanelContext, substituteGroupDataProvider ) {
    let deferred = awPromiseService.instance.defer();
    buildOccurrenceSubstituteGroupTreeStructure( treeLoadInput, columnConfig, subPanelContext, deferred, substituteGroupDataProvider );
    return deferred.promise;
};

function _buildSubstituteOccurrenceTreeForOneToOne( occurrenceSubstituteGroupObject, treeLoadInput ) {
    let vmNodes = [];
    let levelNdx = treeLoadInput.parentNode.levelNdx + 1;
    _.forEach( occurrenceSubstituteGroupObject.substituteSets, function( substituteSet ) {
        _.forEach( substituteSet.substituteLines, function( substituteLine, childNdx ) {
            let substituteBOMLineObj = cdm.getObject( substituteLine.uid );
            let iconURL = iconSvc.getTypeIconURL( substituteBOMLineObj.type );
            let endObjectVmo = viewModelObjectSvc.createViewModelObject( substituteBOMLineObj.uid, 'EDIT', substituteBOMLineObj.uid, substituteBOMLineObj );

            let treeVmNode = awTableTreeSvc.createViewModelTreeNode( endObjectVmo.uid, endObjectVmo.type, endObjectVmo.props.object_string.uiValues[0], levelNdx, childNdx, iconURL );
            treeVmNode.id = treeVmNode.id + treeLoadInput.parentNode.id + childNdx + treeLoadInput.parentNode.levelNdx;
            treeVmNode.alternateID = treeVmNode.id;
            treeVmNode.isLeaf = true;

            treeVmNode.fnd0OccSubstGroupObj = occurrenceSubstituteGroupObject.substituteGroup;
            treeVmNode.fnd0setId = substituteSet.groupSet;
            if( substituteLine.type === 'Cm0RemovedLine' ) {
                treeVmNode.substituteCategory = SubstituteCategory_RemovedOccurrences;
            } else {
                treeVmNode.substituteCategory = SubstituteCategory_SubstituteOccurrences;
            }
            tcVmoService.mergeObjects( treeVmNode, endObjectVmo );

            if ( treeVmNode ) {
                vmNodes.push( treeVmNode );
            }
        } );
    } );
    return vmNodes;
}

/**
* Calls PerformSearch SOA to build substitute group tree nodes.
* @internal
* @param {Object} treeLoadInput Tree Load Input
* @param {Object} columnConfig Column configuartion
* @param {Object} subPanelContext subPanelContext
* @param {Object} deferred deffered object
* @return {resolved} Resolved with an object containing the results of the operation.
*/
function buildOccurrenceSubstituteGroupTreeStructure( treeLoadInput, columnConfig, subPanelContext, deferred, substituteGroupDataProvider ) {
    let vmNodes = [];
    let soaInput = {
        bomLinesInput : aceBackingObjectProviderService.getBackingObjectsSync( subPanelContext.context.occContext.pwaSelection )
    };
    let policyJson = getPropertyPolicyJson();
    return soaSvc.postUnchecked( 'StructureManagement-2024-12-Substitutes', 'fetchSubstituteGroupInfo', soaInput, policyJson ).then(
        function( response ) {
            let retrievingFirstLevel = treeLoadInput.parentNode.levelNdx === -1;
            let isOneToOneSubstituteGroup;

            let endReachedlet = true;
            let startReachedlet = treeLoadInput.startChildNdx <= 0;

            treeLoadInput.pageSize = response.substituteGroupInfoOut.length;

            if( response.substituteGroupInfoOut.length > 0 && response.substituteGroupInfoOut[0].substituteGroupInfo.length > 0 ) {
                _.forEach( response.substituteGroupInfoOut[0].substituteGroupInfo, function( occurrenceSubstituteGroupObject, childNdx ) {
                    let substituteGroupObject = occurrenceSubstituteGroupObject.substituteGroup;
                    let endObjectVmo = viewModelObjectSvc.createViewModelObject( substituteGroupObject.uid, 'EDIT', substituteGroupObject.uid, substituteGroupObject );
                    isOneToOneSubstituteGroup =  endObjectVmo.props.fnd0SubstGroupMode.dbValues[0];
                    if( isOneToOneSubstituteGroup === '1' ) {
                        if ( retrievingFirstLevel ) {
                            columnConfig = initColumsForOccurrenceSubstituteGroupTable( columnConfig, true );
                        }
                        let isRedLineMode = appCtxService.getCtx( 'isRedLineMode' );
                        if( isRedLineMode === 'true' ) {
                            _populateMarkupPropertiesOnBOMLines( treeLoadInput, null, response, subPanelContext, deferred, columnConfig, true, substituteGroupDataProvider );
                        } else {
                            vmNodes = _buildSubstituteOccurrenceTreeForOneToOne( occurrenceSubstituteGroupObject, treeLoadInput );

                            substitutesBuildTreeLoadResult( response, treeLoadInput, vmNodes, startReachedlet, endReachedlet, columnConfig, 'true', deferred );
                        }
                    } else {
                        if ( retrievingFirstLevel ) {
                            columnConfig = initColumsForOccurrenceSubstituteGroupTable( columnConfig, false );
                        }
                        let levelNdx = treeLoadInput.parentNode.levelNdx + 1;
                        let iconURL = iconSvc.getTypeIconURL( substituteGroupObject.type );
                        let treeVmNode = awTableTreeSvc.createViewModelTreeNode( endObjectVmo.uid, endObjectVmo.type, endObjectVmo.props.object_string.uiValues[0], levelNdx, childNdx, iconURL );
                        treeVmNode.id = treeVmNode.id + treeLoadInput.parentNode.id + childNdx + treeLoadInput.parentNode.levelNdx;
                        treeVmNode.alternateID = treeVmNode.id;
                        treeVmNode.isLeaf = false;
                        treeVmNode.substituteCategory = SubstituteCategory_OccSubstituteGroup;
                        tcVmoService.mergeObjects( treeVmNode, endObjectVmo );
                        if ( treeVmNode ) {
                            vmNodes.push( treeVmNode );
                        }
                        substituteGroupDataProvider.json.contextMenuCommandsAnchor = 'aw_occSubstGroupSection';
                        substitutesBuildTreeLoadResult( response, treeLoadInput, vmNodes, startReachedlet, endReachedlet, columnConfig, 'false', deferred );
                    }
                } );
            } else{
                substitutesBuildTreeLoadResult( response, treeLoadInput, vmNodes, startReachedlet, endReachedlet, columnConfig, 'true', deferred );
            }
        } );
}

/* get property policy json for SOA input*/
function getPropertyPolicyJson() {
    return {
        types: [
            {
                name: OccurrenceSubstituteGroup,
                properties: [
                    {
                        name: 'object_string'
                    },
                    {
                        name: 'is_modifiable'
                    },
                    {
                        name: 'fnd0SubstGroupMode'
                    }
                ]
            },
            {
                name: 'Fnd0SubstGroupSet',
                properties: [ {
                    name: 'object_string'
                } ]
            },
            {
                name: 'BOMLine',
                properties: [
                    {
                        name: 'object_string'
                    },
                    {
                        name: 'bl_sequence_no'
                    },
                    {
                        name: 'fnd0bl_line_object_type'
                    },
                    {
                        name: 'bl_quantity'
                    },
                    {
                        name: 'bl_ref_designator'
                    },
                    {
                        name: 'bl_all_notes'
                    }
                ]
            } ]
    };
}
/**
 * Build trr load result SubstituteGroup Table.
 *
 * @param {Object} response - SOA response
 * @param {Object} treeLoadInput - treeLoadInput
 * @param {Object} vmNodes - created vmnodes
 * @param {Boolean} startReachedlet - startReached, required to buils tree load result
 * @param {Boolean} endReachedlet - endReachedlet, required to buils tree load result
 * @param {ColumConfig} columnConfig - Column config returned by SOA
 * @param {String} isOneToOneSubstituteGroup - flag for 1:1 or M:N substitute group
 * @return {resolved} Resolved with an object containing the results of the operation.
 *
 */
function  substitutesBuildTreeLoadResult( response, treeLoadInput, vmNodes, startReachedlet, endReachedlet, columnConfig, isOneToOneSubstituteGroup, deferred ) {
    let tempCursorObject = {
        endReached: endReachedlet,
        startReached: startReachedlet
    };
    let treeLoadResult =  awTableTreeSvc.buildTreeLoadResult( treeLoadInput, vmNodes, true, startReachedlet, endReachedlet, null );
    treeLoadResult.parentNode.cursorObject = tempCursorObject;

    treeLoadResult.columnConfig = columnConfig;

    deferred.resolve( {
        treeLoadResult: treeLoadResult,
        clientScopeURI: clientScopeURI,
        objectSetUri: clientScopeURI,
        fetchSoaResponse : response,
        isOneToOneSubstituteGroup : isOneToOneSubstituteGroup
    } );
}

/**
 * Build column information for SubstituteGroup Table.
 *
 * @param {ColumConfig} columnConfig - Column config returned by SOA
 * @return {Object} Column configuration Info
 *
 */
function initColumsForOccurrenceSubstituteGroupTable( columnConfig, isOneToOne ) {
    let awColumnInfos = [];
    let columnConfigCols = columnConfig.columns;
    for ( let index = 0; index < columnConfigCols.length; index++ ) {
        let pixelWidth = columnConfigCols[index].pixelWidth;
        let columnInfo = {
            field: columnConfigCols[index].propertyName,
            name: columnConfigCols[index].propertyName,
            propertyName: columnConfigCols[index].propertyName,
            displayName: columnConfigCols[index].displayName,
            typeName: columnConfigCols[index].associatedTypeName,
            pixelWidth: pixelWidth,
            hiddenFlag: columnConfigCols[index].hiddenFlag,
            enableColumnResizing: true,
            pinnedRight: false,
            enablePinning: false,
            enableCellEdit: false,
            cellRenderers: [ showMarkupSvc.rowMarkupRenderer  ]
        };
        let awColumnInfo = awColumnSvc.createColumnInfo( columnInfo );
        awColumnInfos.push( awColumnInfo );
    }

    if( !isOneToOne ) {
        let localTextBundle = localeService.getLoadedText( 'OccurrenceManagementConstants' );
        let mappingColumnName = localTextBundle.mappingColumnName;
        let columnInfo = {
            name: 'awb0SubstituteMapping',
            propertyName: 'awb0SubstituteMapping',
            gridID: 'substituteGroupGrid',
            displayName: mappingColumnName,
            minWidth: 20,
            pixelWidth: 350,
            hiddenFlag: false,
            pinnedRight: false,
            enablePinning: false,
            enableCellEdit: false,
            isClientColumn:true,
            clientColumn: true,
            enableColumnHiding : false,
            enableColumnMoving :false,
            cellRenderers: [ showMarkupSvc.rowMarkupRenderer ]
        };
        let awColumnInfo = awColumnSvc.createColumnInfo( columnInfo );
        awColumnInfos.push( awColumnInfo );
    }

    return {
        columnConfigId: columnConfig.columnConfigId,
        columns: awColumnInfos
    };
}

/**
 * @internal
 * prepare createSubstituteGroupInputs
 *
 * @param {Object} pwaSelection - primary work area selection
 * @param {Object} addElementResponse - newly added element response
 * @return {Object} createSubstituteGroupInputs
 */
export let getCreateOneToOneSubstituteOccurrenceInputs = function( pwaSelection, addElementResponse ) {
    let createSubstituteGroupInputs = [];
    _.forEach( pwaSelection, function( primaryElements ) {
        _.forEach( addElementResponse.newElementInfos, function( newElementInfos ) {
            if( newElementInfos.parentElement.uid === primaryElements.props.awb0Parent.dbValues[0] ) {
                _.forEach( newElementInfos.newElements, function( substituteElements ) {
                    let substituteObject = {
                        primaryBOMLines :aceBackingObjectProviderService.getBackingObjectsSync( [ primaryElements ] ),
                        substituteGroupCreateInput : {
                            boName: 'Fnd0OccSubstGroup',
                            propertyNameValues : {
                                object_name: [],
                                fnd0SubstGroupMode:[ '1' ] // 1 is for one to one substitute occurrence
                            }
                        },
                        substituteSets:[ {
                            setId:'',
                            substituteBOMLines: aceBackingObjectProviderService.getBackingObjectsSync( [ substituteElements.occurrence ] )
                        } ]
                    };
                    createSubstituteGroupInputs.push( substituteObject );
                } );
            }
        } );
    } );

    return createSubstituteGroupInputs;
};

/**
 * @internal
 * Get substitute elements to add
 *
 * @param {Object} vmoHovered - vmo of selected elements
 * @return {Object} substituteIndicatorValue
 */
export let getSubstituteIndicatorValue = function( vmoHovered ) {
    let substituteIndicatorValue   = vmoHovered.props.awb0SubstituteIndicator.dbValue;
    if( substituteIndicatorValue & ItemBased_Substitute ) {
        substituteIndicatorValue = ItemBasedSubstitute;
    } else  if( substituteIndicatorValue & OccBasedSubstitute_primary ) {
        substituteIndicatorValue = OccBasedSubstitutePrimary;
    } else  if( substituteIndicatorValue & OccBasedSubstitute_substitute ) {
        substituteIndicatorValue = OccBasedSubstituteSubstitute;
    }
    return substituteIndicatorValue;
};

/**
 * @internal
 * Get tooltip data for substitute components
 *
 * @param {Object} vmoHovered - vmo of selected elements
 * @param {String} substituteOrPrimaryLabel - label for substitute
 * @param {String} tooltipLinkText - text for tooltip link
 * @return {Object} tooltipData
 */
export let showListOfSubstituteComponents = function( vmoHovered, substituteOrPrimaryLabel, tooltipLinkText ) {
    if ( vmoHovered && vmoHovered.props.awb0SubstituteList ) {
        let tooltipList = vmoHovered.props.awb0SubstituteList.displayValues;
        return populateTooltipObjects( tooltipList, substituteOrPrimaryLabel, tooltipLinkText );
    }
};

/**
 * @internal
 * Get tooltip data for primary components
 *
 * @param {Object} vmoHovered - vmo of selected elements
 * @param {String} substituteOrPrimaryLabel - label for primary
 * @param {String} tooltipLinkText - text for tooltip link
 *  @return {Object} tooltipData
 */
export let showListOfPrimaryComponents = function( vmoHovered, substituteOrPrimaryLabel, tooltipLinkText ) {
    if ( vmoHovered && vmoHovered.props.awb0PrimaryComponents ) {
        let tooltipList = vmoHovered.props.awb0PrimaryComponents.displayValues;
        return populateTooltipObjects( tooltipList, substituteOrPrimaryLabel, tooltipLinkText );
    }
};
/**
 * This function populates the tooltip objects for the substitute and primary components
 * @param {Array} tooltipList - list of tooltip objects
 * @param {String} substituteOrPrimaryLabel - label for primary or substitute
 * @param {String} tooltipLinkText - text for tooltip link
 * @return {Object} tooltipData
 */
function populateTooltipObjects( tooltipList, substituteOrPrimaryLabel, tooltipLinkText ) {
    var tooltipData = {
        tooltipObjects : []
    };
    var subArray = [];
    subArray = tooltipList[0].split( ',' );

    for ( var i = 0; i < ( subArray.length > 4 ? 4 : subArray.length ); i++ ) {
        var sub = _uwPropSrv.createViewModelProperty( subArray[i], subArray[i], 'STRING', '', '' );
        tooltipData.tooltipObjects.push( sub );
    }
    //  Update tooltip label with number of overridden contexts
    var tooltipLabel = substituteOrPrimaryLabel;
    tooltipLabel = tooltipLabel.replace( '{0}', subArray.length );
    tooltipData.tooltipLabel = {};
    tooltipData.tooltipLabel = _uwPropSrv.createViewModelProperty( tooltipLabel, tooltipLabel, 'STRING', '', [ '' ] );

    //update tooltip link for more data
    if ( subArray.length > 4 ) {
        var tooltipText = tooltipLinkText;
        tooltipText = tooltipText.replace( '{0}', subArray.length - 4 );
        tooltipData.moreObjects = {};
        tooltipData.moreObjects = _uwPropSrv.createViewModelProperty( tooltipText, tooltipText, 'STRING', tooltipText, [ tooltipText ] );
        tooltipData.enableMoreObjects = {};
        tooltipData.enableMoreObjects.dbValue = true;
    }
    return tooltipData;
}

/**
 * @internal
 * prepare setSubstitutesAsPrimaryInputs
 *
 * @param {Object} pwaSelection - primary work area selection
 * @return {Object} setSubstitutesAsPrimaryInputs
 */
export let getSetSubstitutesAsPrimaryInputs = function( pwaSelection ) {
    let setSubstitutesAsPrimaryInputs = [];
    let substituteElements = aceBackingObjectProviderService.getBackingObjectsSync( pwaSelection );
    _.forEach( substituteElements, function( substituteElement, index ) {
        let substituteElementObject = {
            clientId: index.toString(),
            substituteBomLines: [ substituteElement ]
        };
        setSubstitutesAsPrimaryInputs.push( substituteElementObject );
    } );

    return setSubstitutesAsPrimaryInputs;
};

/**
 * @internal
 * Get substitute group information for selected substitute elements
 * @param {Object} commandContext command context
 * @return {Object} It returns substitute group information for selected substitute elements
 */
export let getSubstituteLinesToBeRemoved = function( commandContext ) {
    let selectedSubstituteLinesInfo = [];
    let updateSubstituteGroups = [];
    let bomLineHavingSubstituteGroup = [];
    // pwaSelection is different for RMB->Remove command and Remove command from Substitutes section in overview panel
    let currentContext = commandContext.context.occContext ? commandContext.context.occContext : commandContext.occContext;
    bomLineHavingSubstituteGroup = aceBackingObjectProviderService.getBackingObjectsSync(  currentContext.pwaSelection );

    _.forEach( commandContext.selectionData.selected, function( selectedObject ) {
        let selectedSubstituteData = {
            groupSet : selectedObject.fnd0setId,
            substituteLines : [ {
                uid : selectedObject.uid,
                type : selectedObject.type
            } ]
        };

        selectedSubstituteLinesInfo.push( selectedSubstituteData );
    } );
    let object = {
        bomLineHavingSubstituteGroup : bomLineHavingSubstituteGroup[0],
        substituteGroup : commandContext.selectionData.selected[0].fnd0OccSubstGroupObj,
        updateSubstituteGroupBomLines : {
            substituteBOMLinesToBeRemoved : selectedSubstituteLinesInfo
        }
    };
    updateSubstituteGroups.push( object );

    return updateSubstituteGroups;
};

export let performSubstituteGroupOccurrencePostRemoveAction = function( commandContext ) {
    let currentContext = commandContext.context.occContext ? commandContext.context.occContext : commandContext.occContext;
    if( currentContext.pwaSelection.length > 0 && currentContext.pwaSelection[0] ) {
        // reload PWA to get removed elements
        let parentObject = cdm.getObject( occmgmtUtils.getParentUid( currentContext.pwaSelection[0] ) );

        // Prepare event data and publish event
        let contextKey = appCtxService.ctx.aceActiveContext.key;
        let soaInput = occmgmtGetSvc.getDefaultSoaInput();
        let eventData = {
            objectsToSelect: [ currentContext.pwaSelection[0] ],
            viewToReact: contextKey,
            nodeToExpandAfterFocus: parentObject.uid,
            getOccSoaInput: soaInput
        };
        eventBus.publish( 'aceLoadAndSelectProvidedObjectInTree', eventData );
    }
};

export default exports = {
    getExistingSetsAsInput,
    getSubstituteSetInfo,
    updateGeneratedsetIdOnState,
    updateListWithBomline,
    updateSelectedObjectsOnState,
    getInputForSubstituteGroupSets,
    getCreatedOccSGObjectName,
    loadNextOccSubstituteGroupTree,
    buildNextTreeTableStructure,
    setSubstituteElementTypeOnUpdate,
    prePopulateOccSubstGrpNameField,
    updatePreviousSelectedUid,
    getSubstituteSetID,
    updateCreatedObjectsOnState,
    getAddElementInput,
    loadOccurrenceSubstituteGroupTree,
    getCreateOneToOneSubstituteOccurrenceInputs,
    getSubstituteIndicatorValue,
    showListOfPrimaryComponents,
    showListOfSubstituteComponents,
    getSetSubstitutesAsPrimaryInputs,
    getSubstituteLinesToBeRemoved,
    performSubstituteGroupOccurrencePostRemoveAction
};
