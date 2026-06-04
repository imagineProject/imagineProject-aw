// Copyright (c) 2024 Siemens

/**
 * @module js/Pma1AssociateProductsService
 */
import cdm from 'soa/kernel/clientDataModel';
import CadBomAlignmentUtil from 'js/CadBomAlignmentUtil';
import ClipboardService from 'js/clipboardService';
import adapterSvc from 'js/adapterService';
import appCtxSvc from 'js/appCtxService';
import viewModelObjectService from 'js/viewModelObjectService';
import _ from 'lodash';

/**
 * Create manageAlignments SOA input object with primary and secondary object with given relation type.
 * @param {Object} primaryObject - Primary object
 * @param {Object} secondaryObject - Secondary object
 * @param {string} relationType - Relation type
 * @param {string} relationIntent - Intent of the relation (create/delete)
 * @returns {object} - Returns created alignmentData object
 */
const getRelationObjectInput = ( primaryObject, secondaryObject, relationType, relationIntent ) => {
    const primaryObj = _.clone( primaryObject );
    const secondaryObj = _.clone( secondaryObject );
    const relationTypeValue = _.clone( relationType );
    const alignmentDataObject = {
        clientId: '',
        intent: relationIntent
    };

    alignmentDataObject.primaryObject = {};
    alignmentDataObject.primaryObject.uid = primaryObj.uid;
    alignmentDataObject.primaryObject.type = primaryObj.type;

    alignmentDataObject.secondaryObject = {};
    alignmentDataObject.secondaryObject.uid = secondaryObj.uid;
    alignmentDataObject.secondaryObject.type = secondaryObj.type;

    alignmentDataObject.relationType = relationTypeValue;

    return alignmentDataObject;
};

const checkIfSourceIsDesign = ( sourceObject ) => {
    const preferences = appCtxSvc.getCtx( 'preferences' );
    return Boolean( preferences?.FND0_DESIGN_TYPES?.includes( sourceObject.type ) );
};

/**
 * Create manageAlignments SOA input with primary and secondary objects with given relation type.
 * @param {Object} primaryObject - Primary object
 * @param {Object} secondaryObjects - Collection of secondary objects
 * @param {string} relationType - Relation type
 * @param {string} relationIntent - Intent of the relation (create/delete)
 * @param {string} isSourceDesign - is source design
 * @returns {object} - Returns list of alignmentData objects
 */
const getManageAlignmentsInput = ( primaryObject, secondaryObjects, relationType, relationIntent, isSourceDesign ) => {
    const alignmentDataObjects = [];
    secondaryObjects.map( secondaryObject =>
        alignmentDataObjects.push( getRelationObjectInput(
            isSourceDesign ? secondaryObject : primaryObject,
            isSourceDesign ? primaryObject : secondaryObject,
            relationType,
            relationIntent
        ) )
    );
    return alignmentDataObjects;
};

/**
 * Get primary selection based on if inside ACE or outside ACE
 * @param {Object} props - props
 * @returns {object} - Returns primary object.
 */
const getPrimarySelection = ( props ) => {
    if ( props?.subPanelContext?.occContext?.pwaSelection?.length > 0 ) {
        return props.subPanelContext.occContext.pwaSelection[0];
    }
    return appCtxSvc.getCtx( 'xrtSummaryContextObject' );
};

/**
 * Update primary selection from selected object.
 * @param {Object} addPanelState -addPanelState
 * @param {Object} props - props
 * @returns {Promise} - Returns a Promise
 */
const updatePrimarySelectionFromSelectedObject = async( addPanelState, props ) => {
    const selectedUid = getPrimarySelection( props ).uid;
    const selected = cdm.getObject( selectedUid );
    const newAddPanelState = { ...addPanelState };
    const resp = await adapterSvc.getAdaptedObjects( [ selected ] );
    if( resp?.length > 0 ) {
        let selectedObject = null;
        if ( viewModelObjectService.isViewModelObject( resp[0] ) ) {
            selectedObject = resp[0];
        } else {
            selectedObject = viewModelObjectService.constructViewModelObjectFromModelObject( resp[0], 'EDIT' );
        }

        newAddPanelState.primarySelection = selected;
        newAddPanelState.selectedObject = selectedObject;
    }
    return newAddPanelState;
};

const getItemId = ( selectedObject ) => {
    if ( selectedObject?.props?.items_tag?.dbValues?.length > 0 ) {
        return cdm.getObject( selectedObject.props.items_tag.dbValues[0] );
    }
    return selectedObject;
};

/**
 * Link selected objects as designs
 * @param {Object} addPanelState - addPanelState
 * @param {Object} sourceObjectsIn - Source Objects
 * @param {Object} props - props
 * @returns {Promise} - Returns a Promise
 */
export const associateProducts = async( addPanelState, sourceObjectsIn, props ) => {
    const newAddPanelState = await updatePrimarySelectionFromSelectedObject( addPanelState, props );
    // Selected ProductEBOM as primary object
    const selectedItem = getItemId( newAddPanelState.selectedObject );
    if ( !selectedItem ) {
        return newAddPanelState;
    }
    const isSourceDesign = checkIfSourceIsDesign( selectedItem );

    // Selected Design as Secondary Objects
    const sourceObjects = sourceObjectsIn;
    const itemArr = [];
    for ( let index = 0; index < sourceObjects.length; ++index ) {
        if ( sourceObjects[index]?.props?.items_tag ) {
            itemArr.push( cdm.getObject( sourceObjects[index].props.items_tag.dbValues[0] ) );
        } else {
            itemArr.push( sourceObjects[index] );
        }
    }
    const createInputList = getManageAlignmentsInput( selectedItem, itemArr, 'Fnd0DesignToBomLink', 'create', isSourceDesign );
    newAddPanelState.createInputList = createInputList;
    return newAddPanelState;
};

/**
 * Link selected objects as designs
 * @param {Object} occContext - occContext object
 * @returns {object} - Returns list of alignmentData objects
 */
export const getCreateInputForAssociateProducts = ( occContext ) => {
    const primarySelection = CadBomAlignmentUtil.getPrimarySelection( occContext );
    if ( !primarySelection ) {
        return [];
    }
    // Selected Collaborative Product EBOM as primary object
    let selectedPrimaryObject = cdm.getObject( primarySelection.uid );
    let primaryItem = null;

    // Get item object from selectedPrimaryObject
    if ( selectedPrimaryObject?.props?.items_tag ) {
        primaryItem = cdm.getObject( selectedPrimaryObject.props.items_tag.dbValues[0] );
    } else {
        // Get the underlying object from the facade object
        let primaryAdaptedObjects = adapterSvc.getAdaptedObjectsSync( [ selectedPrimaryObject ] );
        if( primaryAdaptedObjects.length > 0 ) { primaryItem = getItemId( primaryAdaptedObjects[0] ); }
    }
    if ( !primaryItem ) {
        return [];
    }
    const isSourceDesign = checkIfSourceIsDesign( primaryItem );

    // Copied Design as Secondary Objects
    const selectedSecondaryObjects = appCtxSvc.getCtx( 'awClipBoardProvider' );
    let secondaryItems = [];

    // Get item object from selectedPrimaryObject
    for ( let index = 0; index < selectedSecondaryObjects.length; ++index ) {
        if ( selectedSecondaryObjects[index]?.props?.items_tag ) {
            secondaryItems.push( cdm.getObject( selectedSecondaryObjects[index].props.items_tag.dbValues[0] ) );
        } else {
            // Get the underlying object from the facade object
            let adaptedObjects = adapterSvc.getAdaptedObjectsSync( [ selectedSecondaryObjects[index] ] );
            if( adaptedObjects.length > 0 ) { secondaryItems.push( getItemId( adaptedObjects[0] ) ); }
        }
    }

    return getManageAlignmentsInput( primaryItem, secondaryItems, 'Fnd0DesignToBomLink', 'create', isSourceDesign );
};

/**
 * Get input object for set primary operation
 * @param {Object} data - Declarative view model object
 * @param {string} relationType - The relation type to create Relation object
 * @param {boolean} addToClipboard - true to add selected secondary object to clipboard else false
 * @returns {object} - Returns list of alignmentData object.
 */
const getSoaInputForDisassociateProducts = ( data, relationType, addToClipboard ) => {
    let selectedPrimaryObject = null;
    let selectedSecondaryObjects = [];
    const relationContext = appCtxSvc.getCtx( 'relationContext' );
    if( relationContext ) {
        const relationInfo = relationContext.relationInfo;
        if( relationInfo.length > 0 ) { selectedPrimaryObject = relationInfo[0].primaryObject; }
        for ( let i = 0; i < relationInfo.length; i++ ) {
            selectedSecondaryObjects.push( relationInfo[i].secondaryObject );
        }
    } else{
        const xrtSummaryContextObject = appCtxSvc.getCtx( 'xrtSummaryContextObject' );
        const mselected = appCtxSvc.getCtx( 'mselected' );
        if( xrtSummaryContextObject ) { selectedPrimaryObject = appCtxSvc.ctx.xrtSummaryContextObject; }
        if( mselected ) { selectedSecondaryObjects = mselected; }
    }

    if ( !selectedPrimaryObject ) {
        return [];
    }

    data.dispatch( { path: 'data.primarySelection', value: cdm.getObject( selectedPrimaryObject.uid ) } );

    // Get the persistent obj from the facade obj
    const primaryAdaptedObjs = adapterSvc.getAdaptedObjectsSync( [ selectedPrimaryObject ] );

    // Get the Item tag of primary object
    let selectedPrimaryItem = null;
    if( primaryAdaptedObjs.length > 0 ) {
        selectedPrimaryItem = getItemId( primaryAdaptedObjs[0] );
    }
    // if primary object is not found, return empty object
    if( !selectedPrimaryItem ) {
        return [];
    }
    const isSourceDesign = checkIfSourceIsDesign( selectedPrimaryItem );

    // Get the Item tag of secondary objects
    const selectedSecondaryItems = [];
    for ( let i = 0; i < selectedSecondaryObjects.length; i++ ) {
        selectedSecondaryItems.push( getItemId( selectedSecondaryObjects[i] ) );
    }

    // Add removed designs to clipboard
    if ( addToClipboard === true ) {
        ClipboardService.instance.setContents( selectedSecondaryItems );
    }

    return getManageAlignmentsInput( selectedPrimaryItem, selectedSecondaryItems, relationType, 'delete', isSourceDesign );
};

/**
 * Get input object for de-link operation
 * @param {Object} dataObj - Declarative view model object
 * @returns {object} - Returns list of alignmentData object.
 */
export const disassociateProducts = ( dataObj ) => {
    if ( !dataObj ) {
        return [];
    }
    return getSoaInputForDisassociateProducts( dataObj, 'Fnd0DesignToBomLink', true );
};

/**
 * Link Design top to EBOM root service
 * @param {$q} $q - Service to use.
 * @param {soa_kernel_clientDataModel} cdm - Service to use
 * @param {clipboardService} clipboardSvc - Service to use
 * @param {adapterService} adapterSvc - Service to use
 * @param {appCtxService} appCtxSvc - Service to use
 * @param {viewModelObjectService} viewModelObjectService - Service to use
 * @returns {object} - object
 */

const exports = {
    associateProducts,
    getCreateInputForAssociateProducts,
    disassociateProducts
};

export default exports;
