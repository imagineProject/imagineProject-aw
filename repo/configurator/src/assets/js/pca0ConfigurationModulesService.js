// Copyright (c) 2024 Siemens

/**
 * @module js/pca0ConfigurationModulesService
*/
import addObjectUtils from 'js/addObjectUtils';
import appCtxService from 'js/appCtxService';
import eventBus from 'js/eventBus';
import iconSvc from 'js/iconService';
import pca0ConfiguratorExplorerCommonUtils from 'js/pca0ConfiguratorExplorerCommonUtils';
import pca0Constants from 'js/Pca0Constants';
import pca0InlineAuthoringHandler from 'js/pca0InlineAuthoringHandler';
import soaSvc from 'soa/kernel/soaService';
import _ from 'lodash';

/**
 * Recursively attaches child nodes to the parent node in the view model tree and populates all the children
 * to the nodesToAttach array.
 *
 * @param {Object} parentNode - The parent node to which child nodes will be attached.
 * @param {Array} variabilityTreeData - The array containing the variability tree data.
 * @param {Object} viewModelObjectMap - The map of view model objects keyed by their UIDs.
 * @param {number} levelIndex - The current level index in the tree.
 * @param {number} childIndex - The index of the child node.
 * @param {string} iconURL - The URL of the icon to be used for the nodes.
 * @param {Array} nodesToAttach - The array to which the newly created nodes will be added.
 */
const _attachChildNodes = ( parentNode, variabilityTreeData, viewModelObjectMap, levelIndex, childIndex, iconURL, nodesToAttach ) => {
    const createdModule = variabilityTreeData.find( item => item.nodeUid === parentNode.uid );
    const childrenUids = _.get( createdModule, 'childrenUids', [] );

    childrenUids.forEach( childUid => {
        const childModelObject = viewModelObjectMap[childUid];
        const childNode = pca0ConfiguratorExplorerCommonUtils.createLeafViewModelNode( childModelObject, levelIndex + 1, childIndex, iconURL, parentNode.uid );
        pca0InlineAuthoringHandler.addChildToParentsChildrenArray( parentNode, childNode, childIndex );
        nodesToAttach.push( childNode );

        // Recursively attach child nodes
        _attachChildNodes( childNode, variabilityTreeData, viewModelObjectMap, levelIndex + 1, childIndex, iconURL, nodesToAttach );
    } );
};

/**
 *   Export APIs section starts here
 */

let exports = {};

/**
 * Prepare the SOA input to create a new Module
 * @param {Object} data - the ViewModel data of the Add Module Dialog
 * @param {Object} editHandler - editHandler of the Add Module Dialog
 * @param {String} loadedXrtType - type of selected rule
 * @returns {Object} createRelateAndSubmitObjects SOA input
 */
export const getModuleCreateInput = ( data, editHandler, loadedXrtType ) => {
    const createInput = [];
    const extensionVMProps = null;
    const creationType = {
        props: {
            type_name: {
                dbValues: [ loadedXrtType ]
            }
        }
    };

    const rootContext = appCtxService.getCtx( 'pselected' );

    // Get the module creation input from the framework utility function
    const createModulesInput = addObjectUtils.getCreateInput( data, extensionVMProps, creationType, editHandler );

    const moduleInput = {
        createInputs: [],
        parent: rootContext
    };

    const createInputsObject = {
        childCreateInputs: [],
        clientID: ''
    };

    const createIn = {
        boName: createModulesInput[0].createData.boName,
        compoundCreateInput: createModulesInput[0].createData.compoundCreateInput,
        propertyNameValues: createModulesInput[0].createData.propertyNameValues
    };

    // Add the create input details to the createInputsObject
    createInputsObject.createIn = createIn;

    // Push the createInputsObject into createInputs
    moduleInput.createInputs.push( createInputsObject );

    // Add the moduleInput to the final createInput array
    createInput.push( moduleInput );

    return createInput;
};

/**
 * This function adds newly created module as the first child to the selected object in the tree
 * @param {Object} soaResponse the response of createRelateAndSubmitObjects soa
 * @param {Object} selected object in the tree
 * @param {Object} treeDataProvider treeDataProvider of modules grid
 * @param {Boolean} isSibling - true for Sibling command and false for Child command
 * @param {Boolean} isPanelPinned - true/false based on whether panel is pinned or not.
 * @returns {Boolean} true every time
 */
export const addNewModuleToGrid = ( soaResponse, selected, treeDataProvider, isSibling, isPanelPinned ) => {
    const { created } = _.get( soaResponse, 'ServiceData', {} );
    const { variabilityTreeData, viewModelObjectMap } =  soaResponse;

    if ( created ) {
        const viewModelCollection = treeDataProvider.getViewModelCollection();
        const loadedVMOs = viewModelCollection.getLoadedViewModelObjects();

        //Adding newly created module based on the command clicked.
        //Child command - selected object will be the parent of newly created moudle.
        //Sibling command - selected object's parent will be the parent of newly created moudle.
        const parentUid = isSibling ? selected.parentUID : selected.uid;
        const existingParentNodeIdx = viewModelCollection.findViewModelObjectById( parentUid );
        const parentVMO = viewModelCollection.getViewModelObject( existingParentNodeIdx );

        // Expand parent node if it's collapsed
        if ( parentVMO.__expandState ) {
            eventBus.publish( `${treeDataProvider.name}.expandTreeNode`, { parentNode: parentVMO } );
        }

        // Create vmNode for the newly created module
        const createdObj = created[0];
        const createdModelObject = viewModelObjectMap[createdObj];

        const childlevelIndex = parentVMO.levelNdx + 1;
        const childIndex = 0;
        const iconURL = iconSvc.getTypeIconURL( pca0Constants.CFG_OBJECT_TYPES.CONFIGURATION_MODULE );
        const newViewModelNode = pca0ConfiguratorExplorerCommonUtils.createLeafViewModelNode( createdModelObject, childlevelIndex, childIndex, iconURL, parentVMO.uid );

        //create and attach child nodes with their children populated in them to the newly created module
        const nodesToAttach = [ newViewModelNode ];
        _attachChildNodes( newViewModelNode, variabilityTreeData, viewModelObjectMap, childlevelIndex, childIndex, iconURL, nodesToAttach );

        // Add the new module to the parent's children array
        pca0InlineAuthoringHandler.addChildToParentsChildrenArray( parentVMO, newViewModelNode, childIndex );
        const createdModuleIdx = existingParentNodeIdx + 1;
        loadedVMOs.splice( createdModuleIdx, 0, ...nodesToAttach );

        loadedVMOs.splice( existingParentNodeIdx, 1, parentVMO );

        treeDataProvider.update( loadedVMOs );
        // change the selection to the newly created module only if panel is not pinned
        if( !isPanelPinned ) {
            treeDataProvider.selectionModel.setSelection( newViewModelNode );
        }
    }
    //We are returning true always as we are showing Modules tree instead of empty work area component
    return true;
};

/**
 * This function updates parentContext details of xrtState with selected object details
 * @param {Object} xrtState xrtState of the add module
 * @param {Object} toolbarSelection selection details when user clicks on toolbar
 * @param {Object} contextMenuSelection selection details when user clicks on context menu
 * @param {Boolean} isSibling - true for Sibling command and false for Child command
 */
export const populateParentContext = ( xrtState, toolbarSelection, contextMenuSelection, isSibling ) => {
    let wsoThreadPath = 'REF(wso_thread,Cfg0ConfigModuleThreadCreI).cfg0ParentContext';
    const newXrtState = { ...xrtState.getValue() };
    const xrtVmoProps = _.get( newXrtState.xrtVMO, 'props', null );
    const keys = Object.keys( xrtVmoProps );
    // LCS-1266690 - Parent Context property value isn't populated in Add Module Panel if Custom Module Object has Custom Thread
    // For custom module object with custom thread, the wsoThreadPath will be different.
    // Finding an exact key that already includes the intended type which is Cfg0ConfigModuleThreadCreI. If not found, fallback to the one that has cfg0ParentContext else Default to the original
    wsoThreadPath = keys.find( key => key.includes( 'Cfg0ConfigModuleThreadCreI' ) ) || keys.find( key => key.includes( 'cfg0ParentContext' ) ) || wsoThreadPath;
    const parentContext = xrtVmoProps ? xrtVmoProps[wsoThreadPath] : null;
    const selected = toolbarSelection || contextMenuSelection;

    if ( parentContext ) {
        let selectedObjDisplayName = '';
        let selectedObjUid = selected[0].uid;
        //we don't have displayName for the selected object in case of no selection in PWA
        if ( selected[0].displayName ) {
            if ( selected[0].modelType.typeHierarchyArray.includes( pca0Constants.CFG_OBJECT_TYPES.ABS_CONFIGURATION_MODULE ) ) {
                //if PWA selection is Module, we are populating displayName and uid.
                //for child command - populate with childContext of selected module
                //for sibling command - populate with parentContext of selected module
                selectedObjDisplayName = isSibling ? selected[0].props.cfg0ParentContext.uiValue : selected[0].props.cfg0ChildContext.uiValue;
                selectedObjUid = isSibling ? selected[0].props.cfg0ParentContext.dbValue : selected[0].props.cfg0ChildContext.dbValue;
            } else {
                selectedObjDisplayName = selected[0].displayName;
            }
        } else {
            //if there is no displayName, we are creating it using cellHeader1 and cellHeader2
            selectedObjDisplayName = `${selected[0].cellHeader2}-${selected[0].cellHeader1}`;
        }

        //updating parentContext with selected object details
        newXrtState.xrtVMO.props[wsoThreadPath] = {
            ...parentContext,
            dbValue: selectedObjUid,
            displayValues: [ selectedObjDisplayName ],
            uiValue: selectedObjDisplayName,
            newValue: selectedObjUid,
            newDisplayValues: [ selectedObjDisplayName ],
            isEditable: false,
            editable: false,
            valueUpdated: true
        };

        xrtState.update( newXrtState );
    }
};

/**
 * This function updates 'toLabelProp' object with display values based on the selected item.
 * @param {Object} toolbarSelection - The selection from the toolbar.
 * @param {Object} contextMenuSelection - The selection from the context menu.
 * @param {Object} toLabelProp - The object to populate with display values.
 * @param {Object} parentVmoOfSelected - The parentVmo of selected object.
 * @param {Boolean} isSibling - true for Sibling command and false for Child command
 * @returns {Object} The updated 'toLabelProp' object.
 */
export const populateToLabelProp = ( toolbarSelection, contextMenuSelection, toLabelProp, parentVmoOfSelected, isSibling ) => {
    const selected = toolbarSelection || contextMenuSelection;

    // If displayName is not available, create it using cellHeader1 and cellHeader2.
    // For Sibling command, displayName should be populated from parentVmoOfSelected.
    let selectedObjDisplayName;
    if( isSibling ) {
        selectedObjDisplayName = parentVmoOfSelected?.displayName;
    }else {
        selectedObjDisplayName = selected[0].displayName || `${selected[0].cellHeader2}-${selected[0].cellHeader1}`;
    }

    return {
        ...toLabelProp,
        displayValues: [ selectedObjDisplayName ],
        uiValue: selectedObjDisplayName,
        newDisplayValues: [ selectedObjDisplayName ]
    };
};

/**
 * Fetches details of the parent node from the tree data provider.
 * @param {Object} treeDataProvider - The tree data provider object.
 * @param {Object} selected - The selected node object containing parentUID.
 * @returns {Object} - Details of the parent node, or null if not found.
 */
export const fetchParentDetails = ( treeDataProvider, selected ) => {
    const viewModelCollection = treeDataProvider.getViewModelCollection();
    const parentNodeIdx = viewModelCollection.findViewModelObjectById( selected.parentUID );
    return viewModelCollection.getViewModelObject( parentNodeIdx );
};

/**
 * This function resets the properties(childContext, name, description) of Add Module panel.
 * @param {Object} xrtState - The xrtState of Add Module panel.
 */
export const resetPropertiesOfAddModuleDialog = ( xrtState ) => {
    const newXrtState = { ...xrtState.getValue() };
    const { props: xrtVmoProps } = newXrtState.xrtVMO;

    if ( xrtVmoProps ) {
        const { cfg0ChildContext, object_name, object_desc } = xrtVmoProps;

        newXrtState.xrtVMO.props = {
            ...xrtVmoProps,
            cfg0ChildContext: {
                ...cfg0ChildContext,
                dbValue: null,
                value: null,
                uiValue: ''
            },
            object_name: {
                ...object_name,
                dbValue: null,
                value: null,
                uiValue: ''
            },
            object_desc: {
                ...object_desc,
                dbValue: null,
                value: null,
                uiValue: ''
            }
        };

        xrtState.update( newXrtState );
    }
};
/**
 * Retrieves or creates a perspective object for a given context UID.
 *
 * This function first checks if the perspective object is already stored in the session storage.
 * If not, it retrieves the perspective object using a service call and sets some properties on it.
 * Finally, it updates the session storage with the new context-to-perspective mapping.
 *
 * @param {String} contextUid - The UID of the context for which the perspective object is to be retrieved or created.
 * @returns {Promise<String>} - The UID of the perspective object.
 */
export const getPerspectiveForModuleConditionEditor = async( contextUid ) => {
    let perspectiveObj = {};
    const moduleParentCtxToParentCtxPerspectiveMap = JSON.parse( sessionStorage.getItem( pca0Constants.CONTEXT_TO_PERSPECTIVE_MAP_KEY ) ) || {};

    // Check if the perspective object is already stored in the session storage
    if ( moduleParentCtxToParentCtxPerspectiveMap[contextUid] ) {
        perspectiveObj.uid = moduleParentCtxToParentCtxPerspectiveMap[contextUid].uid;
        perspectiveObj.type = 'Cfg0ConfiguratorPerspective';
    }

    // If the perspective object is not found in the session storage, retrieve it using a service call
    if ( !perspectiveObj.uid ) {
        const getPropertiesInput = { objects: [ { uid: contextUid } ], attributes: [ 'cfg0ConfigPerspective' ] };
        const response = await soaSvc.postUnchecked( 'Core-2006-03-DataManagement', 'getProperties', getPropertiesInput );
        perspectiveObj = Object.values( response.modelObjects ).find( obj => obj.type === 'Cfg0ConfiguratorPerspective' );
    }

    // Get the root perspective from the application context
    const rootPerspective = appCtxService.getCtx( 'ConfiguratorCtx.configPerspective' );
    const newEffectivity = _.get( rootPerspective, 'props.cfg0RuleSetEffectivity.dbValues[0]', '' ) || '';
    const newRevisionRule = _.get( rootPerspective, 'props.cfg0RevisionRule.dbValues[0]', '' ) || '';


    // Get the stored effectivity and revision rule from the session storage
    const storedEffectivity = moduleParentCtxToParentCtxPerspectiveMap[contextUid]?.effectivity || '';
    const storedRevisionRule = moduleParentCtxToParentCtxPerspectiveMap[contextUid]?.revisionRule || '';

    // If the effectivity or revision rule has changed, update the perspective object properties
    if ( newEffectivity !== storedEffectivity || newRevisionRule !== storedRevisionRule ) {
        const setPropertiesInput = {
            info: [ {
                object: perspectiveObj,
                vecNameVal: [
                    { name: 'cfg0RuleSetEffectivity', values: [ newEffectivity ] },
                    { name: 'cfg0RevisionRule', values: [ newRevisionRule ] }
                ]
            } ]
        };

        await soaSvc.postUnchecked( 'Core-2010-09-DataManagement', 'setProperties', setPropertiesInput );
    }

    // Update the session storage with the new context-to-perspective mapping
    const newmoduleParentCtxToParentCtxPerspectiveMap = {
        ...moduleParentCtxToParentCtxPerspectiveMap,
        [contextUid]: {
            uid: perspectiveObj.uid,
            effectivity: newEffectivity,
            revisionRule: newRevisionRule
        }
    };

    sessionStorage.setItem( pca0Constants.CONTEXT_TO_PERSPECTIVE_MAP_KEY, JSON.stringify( newmoduleParentCtxToParentCtxPerspectiveMap ) );

    return perspectiveObj.uid;
};
export default exports = {
    getModuleCreateInput,
    addNewModuleToGrid,
    populateParentContext,
    populateToLabelProp,
    fetchParentDetails,
    resetPropertiesOfAddModuleDialog,
    getPerspectiveForModuleConditionEditor
};
