// Copyright (c) 2022 Siemens

/**
 * @module js/CadBomAlignmentService
 */
import cdm from 'soa/kernel/clientDataModel';
import ClipboardService from 'js/clipboardService';
import adapterSvc from 'js/adapterService';
import appCtxSvc from 'js/appCtxService';
import viewModelObjectService from 'js/viewModelObjectService';
import eventBus from 'js/eventBus';
import CadBomAlignmentUtil from 'js/CadBomAlignmentUtil';
import cbaRefreshObjectsService from 'js/cbaRefreshObjectsService';
import cbaObjectTypeService from 'js/cbaObjectTypeService';
import cbaConstants from 'js/cbaConstants';

/**
 * Create manageAlignments SOA input object with primary and secondary object with given relation type.
 * @param {Object} primaryObject - Primary object
 * @param {Object} secondaryObject - Secondary object
 * @param {string} relationType - Relation type
 * @param {string} alignmentIntent - Intent of relation (create/delete).
 * @returns {object} - Returns created alignmentData object
 */
let _manageAlignmentObject = function( primaryObject, secondaryObject, relationType, alignmentIntent ) {
    let alignmentDataObject = {
        clientId: '',
        intent: alignmentIntent
    };

    alignmentDataObject.primaryObject = {};
    alignmentDataObject.primaryObject.uid = primaryObject.uid;
    alignmentDataObject.primaryObject.type = primaryObject.type;

    alignmentDataObject.secondaryObject = {};
    alignmentDataObject.secondaryObject.uid = secondaryObject.uid;
    alignmentDataObject.secondaryObject.type = secondaryObject.type;

    alignmentDataObject.relationType = relationType;

    return alignmentDataObject;
};

/**
 * Create manageAlignments SOA input with primary and secondary objects with given relation type.
 * @param {Object} primaryObject - Primary object
 * @param {Object} secondaryObjects - Collection of secondary objects
 * @param {string} relationType - Relation type
 * @param {boolean} useXRTSecondaryAsRelationPrimary - Use XRT secondary selected objects as primary in relation.
 * @param {string} alignmentIntent - Intent of relation (create/delete).
 * @returns {object} - Returns list of alignmentData objects
 */
let _manageAlignmentObjects = function( primaryObject, secondaryObjects, relationType, useXRTSecondaryAsRelationPrimary, alignmentIntent ) {
    let alignmentDataObjects = [];
    for( let itr = 0, len = secondaryObjects.length; itr < len; ++itr ) {
        if( useXRTSecondaryAsRelationPrimary === true ) {
            alignmentDataObjects.push( _manageAlignmentObject( secondaryObjects[ itr ], primaryObject, relationType, alignmentIntent ) );
        } else {
            alignmentDataObjects.push( _manageAlignmentObject( primaryObject, secondaryObjects[ itr ], relationType, alignmentIntent ) );
        }
    }
    return alignmentDataObjects;
};

/**
 * Update primary selection from selected object.
 * @param {Object} data - Declarative view model object
 * @param {Object} occContext - occContext object
 */
let _updatePrimarySelectionFromSelectedObject = function( data, occContext ) {
    let selectedUid = CadBomAlignmentUtil.getPrimarySelection( occContext ).uid;
    let selected = cdm.getObject( selectedUid );
    data.primarySelection = selected;
    let targetObjs = [];

    if( selected && selected.props && selected.props.awb0Archetype !== undefined ) {
        let sourceObj = cdm.getObject( selected.props.awb0Archetype.dbValues[ 0 ] );
        targetObjs.push( sourceObj );
    } else {
        targetObjs.push( selected );
    }

    let adaptedObjects = adapterSvc.getAdaptedObjectsSync( targetObjs );
    if( viewModelObjectService.isViewModelObject( adaptedObjects[ 0 ] ) ) {
        data.selectedObject = adaptedObjects[ 0 ];
    } else {
        data.selectedObject = viewModelObjectService.constructViewModelObjectFromModelObject( adaptedObjects[ 0 ], 'EDIT' );
    }
};


/**
 * Align selected objects as designs
 * @param {Object} data - Declarative view model object
 * @param {Object} useXRTSecondaryAsRelationPrimary - useXRTSecondaryAsRelationPrimary
 * @param {Object} sourceObjectsIn -source objects in
 * @param {Object} occContext - occContext object
 */
export const alignSelectedObjects = function( data, useXRTSecondaryAsRelationPrimary, sourceObjectsIn, occContext ) {
    _updatePrimarySelectionFromSelectedObject( data, occContext );

    let sourceObjects = [];

    if ( typeof data.createdMainObject === 'undefined' || data.createdMainObject === null ) {
        sourceObjects = sourceObjectsIn;
    } else {
        sourceObjects.push( data.createdObjects[ 0 ] );
    }

    let createInputList = _manageAlignmentObjects( data.selectedObject, sourceObjects, 'TC_Is_Represented_By', useXRTSecondaryAsRelationPrimary, 'create' );
    eventBus.publish( 'alignSelectedObjects', createInputList );
};

/**
 * Get input object remove operation
 * @param {Object} dataObj - Declarative view model object
 * @param {Object} occContext - occContext object
 * @returns {object} - Returns list of relation object.
 */
export const getRemoveInput = function( dataObj, occContext ) {
    return exports.getSoaInput( dataObj, 'TC_Is_Represented_By', true, false, occContext, 'delete' );
};

/**
 * Get input object for remove part operation
 * @param {Object} dataObj - Declarative view model object
 * @param {string} useXRTSecondaryAsRelationPrimary - Use XRT secondary selected objects as primary in relation.
 * @param {Object} occContext - occContext object
 * @returns {object} - Returns list of relation object.
 */
export const getRemovePartInput = function( dataObj, useXRTSecondaryAsRelationPrimary, occContext ) {
    // This will be called from Json hence String "true"
    return exports.getSoaInput( dataObj, 'TC_Is_Represented_By', true, useXRTSecondaryAsRelationPrimary === 'true', occContext, 'delete' );
};

/**
 * Get input object for set primary operation
 * @param {Object} dataObj - Declarative view model object
 * @param {Object} occContext - occContext object
 * @returns {object} - Returns list of relation object.
 */
export const getSetPrimaryInput = function( dataObj, occContext ) {
    return exports.getSoaInput( dataObj, 'TC_Primary_Design_Representation', false, false, occContext, 'create' );
};

/**
 * Get input object for align part-design operation
 * @param {Object} dataObj - Declarative view model object
 * @param {Object} occContext - occContext object
 * @returns {object} - Returns list of relation object.
 */
export const getAlignPartToDesignInput = function( dataObj, occContext ) {
    return exports.getSoaInput( dataObj, 'TC_Is_Represented_By', false, true, occContext, 'create' );
};

/**
 * Get input object for paste operation
 * @param {Object} data - Declarative view model object
 * @param {Object} occContext - occContext object
 * @param {Object} clipBoardInput - input from clipboard
 * @returns {object} - Returns list of relation object to paste
 */
export const getPasteInput = function( data, occContext, clipBoardInput ) {
    _updatePrimarySelectionFromSelectedObject( data, occContext );
    let primaryQualifierType = cbaObjectTypeService.getObjectQualifierType( data.selectedObject );
    let secondaryQualifierType = cbaObjectTypeService.getObjectsQualifierType( clipBoardInput );

    let typeKeyToConstantMap = {};
    typeKeyToConstantMap[ cbaConstants.DESIGN ] = cbaConstants.PART;
    typeKeyToConstantMap[ cbaConstants.PART ] = cbaConstants.DESIGN;

    let secondaryObjects = secondaryQualifierType[ typeKeyToConstantMap[ primaryQualifierType ] ];
    let secondaryAdaptedObjects = adapterSvc.getAdaptedObjectsSync( secondaryObjects );

    let useXRTSecondaryAsRelationPrimary = primaryQualifierType === cbaConstants.DESIGN;

    return _manageAlignmentObjects( data.selectedObject, secondaryAdaptedObjects, 'TC_Is_Represented_By', useXRTSecondaryAsRelationPrimary, 'create' );
};

/**
 * Get input object for set primary operation
 * @param {Object} dataObj - Declarative view model object
 * @param {string} relationType - The relation type to create Relation object
 * @param {boolean} addToClipboard - true to add selected secondary object to clipboard else false
 * @param {boolean} useXRTSecondaryAsRelationPrimary - Use XRT secondary selected objects as primary in relation.
 * @param {Object} occContext - occContext object
 * @param {string} alignmentIntent - Intent of relation (create/delete).
 * @returns {object} - Returns list of relation object.
 */
export const getSoaInput = function( dataObj, relationType, addToClipboard, useXRTSecondaryAsRelationPrimary, occContext, alignmentIntent ) {
    let selectedPrimaryObject = CadBomAlignmentUtil.getPrimarySelection( occContext );
    let selectedPrimaryUid = selectedPrimaryObject?.uid;

    dataObj.primarySelection = cdm.getObject( selectedPrimaryUid );
    let selectedSecondaryObjects = appCtxSvc.getCtx( 'mselected' );

    if( selectedPrimaryObject?.props?.awb0Archetype !== undefined ) {
        let sourceObj = cdm.getObject( selectedPrimaryObject.props.awb0Archetype.dbValues[ 0 ] );
        selectedPrimaryObject = sourceObj;
    }

    let primaryAdaptedObjs = adapterSvc.getAdaptedObjectsSync( [ selectedPrimaryObject ] );

    let adaptedObjs = adapterSvc.getAdaptedObjectsSync( selectedSecondaryObjects );
    // Add removed designs to clipboard
    if( addToClipboard === true ) {
        ClipboardService.instance.setContents( adaptedObjs );
    }
    return _manageAlignmentObjects( primaryAdaptedObjs[ 0 ], adaptedObjs, relationType, useXRTSecondaryAsRelationPrimary, alignmentIntent );
};

/**
 * Get input for refresh object SOA
 * @param {Array} primarySelection - Primary elements list
 * @param {Array} secondarySelection - Secondary elements list
 * @returns {Array} - List of elements to refresh
 */
export const getRefreshObjectsInput = function( primarySelection, secondarySelection ) {
    return cbaRefreshObjectsService.getElementsToRefresh( primarySelection, secondarySelection );
};

/**
 * Create Top nodes alignment input for passing it to manageAlignments SOA
 * @param {Object} trgTop target top revison object
 * @param {Object} srcTop source top revision object
 * @param {string} alignmentIntent intent of relation (create/delete)
 * @returns {Array} The list of alignment input object
 */
let getManageAlignmentsSOAInputForTop = function( trgTop, srcTop, alignmentIntent ) {
    let srcTopElement = cdm.getObject( srcTop.props.awb0UnderlyingObject.dbValues[0] );
    let trgTopElement = cdm.getObject( trgTop.props.awb0UnderlyingObject.dbValues[0] );
    let relationType = cbaConstants.ALIGNMENT_RELATION_PART_EBOM;
    let trgTopQualifierType = cbaObjectTypeService.getObjectQualifierType( trgTopElement );
    if( cbaConstants.PRODUCT_EBOM === trgTopQualifierType ) {
        trgTopElement = cdm.getObject( trgTopElement.props.items_tag.dbValues[ 0 ] );
        srcTopElement = cdm.getObject( srcTopElement.props.items_tag.dbValues[ 0 ] );
        relationType = cbaConstants.ALIGNMENT_RELATION_PRODUCT_EBOM;
    }
    return _manageAlignmentObjects( trgTopElement, [ srcTopElement ], relationType, false, alignmentIntent );
};

/**
 * Create Top nodes alignment input for passing it to manageAlignments SOA
 * @param {Object} trgTop target top revison object
 * @param {Object} srcTop source top revision object
 * @returns {Array} The list of alignment input object
 */
export const getTopAlignmentInput = function( trgTop, srcTop ) {
    return getManageAlignmentsSOAInputForTop( trgTop, srcTop, 'create' );
};

/**
 * Create Top nodes Un-alignment input for passing it to manageAlignments SOA
 * @param {Object} trgTop target top revison object
 * @param {Object} srcTop source top revision object
 * @returns {Array} The list of alignment input object
 */
export const getTopUnAlignmentInput = function( trgTop, srcTop ) {
    return getManageAlignmentsSOAInputForTop( trgTop, srcTop, 'delete' );
};

/**
 * CAD-BOM Alignment service
 * @param {$q} $q - Service to use.
 * @param {soa_kernel_clientDataModel} cdm - Service to use
 * @param {clipboardService} clipboardSvc - Service to use
 * @param {adapterService} adapterSvc - Service to use
 * @param {appCtxService} appCtxSvc - Service to use
 * @param {viewModelObjectService} viewModelObjectService - Service to use
 * @returns {object} - object
 */

const exports = {
    alignSelectedObjects,
    getRemoveInput,
    getRemovePartInput,
    getSetPrimaryInput,
    getAlignPartToDesignInput,
    getSoaInput,
    getRefreshObjectsInput,
    getTopAlignmentInput,
    getTopUnAlignmentInput,
    getPasteInput
};
export default exports;
