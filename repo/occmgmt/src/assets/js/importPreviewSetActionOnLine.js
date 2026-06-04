//@<COPYRIGHT>@
//==================================================
//Copyright 2020.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/*global
 define
 */

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/importPreviewSetActionOnLine
 */
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';
import uwPropertySvc from 'js/uwPropertyService';
import eventBus from 'js/eventBus';
import localeService from 'js/localeService';

var exports = {};

/** locale bundle which will load message json file for the service once  */
const localBundle = localeService.getLoadedText( 'OccmgmtImportExportConstants' );

/** Holds the list of all VMOs which have been updated */
let changedVMOList = [];

/** Internal name of ID property */
const INTERNAL_NAME_FOR_ID_PROPERTY = 'item_id';

/**
 * API will return the property mapped to the ID column.
 */
let getPropFieldForID = function() {
    let propNameMappedToID = undefined;
    if ( !_.isUndefined( appCtxSvc.getCtx( 'ImportBOMContext' ) ) && !_.isUndefined( appCtxSvc.getCtx( 'ImportBOMContext.viewModelPropertiesForHeader' ) ) ) {
        let headerVMOMappedToIDField = _.filter( appCtxSvc.getCtx( 'ImportBOMContext.viewModelPropertiesForHeader' ), function( viewModelPropHeader ) {
            return viewModelPropHeader.dbValue && viewModelPropHeader.dbValue.length > 0
            && viewModelPropHeader.dbValue.split( '.' )[1] && _.isEqual( viewModelPropHeader.dbValue.split( '.' )[1], INTERNAL_NAME_FOR_ID_PROPERTY );
        } );
        if( headerVMOMappedToIDField.length > 0 ) {
            propNameMappedToID = headerVMOMappedToIDField[0].uiValue.replace( localBundle.required, '' );
        }
    }
    return propNameMappedToID;
};

/**
 * This API represents the criteria we use to find reused assemblies in the view.
 * @param {*} selectedVMO selected ViewModelObject
 * @param {*} loadedVMO Loaded view model
 */
let criteriaForReusedAssembly = function( selectedVMO, loadedVMO ) {
    if ( checkIfNewImportIsEnabled() ) {
        if( selectedVMO.item_id && loadedVMO.item_id ) {
            return _.isEqual( selectedVMO.item_id, loadedVMO.item_id );
        }
    } else {
        // TO DO: Remove below for TC2512
        let ID = getPropFieldForID();
        return ID && _.isEqual( loadedVMO.props[ID].uiValue, selectedVMO.props[ID].uiValue );
    }
};

/**
 * Finds reused assembly in all collapsed nodes of the tree.
 * @param {*} vmo ViewModelObject
 * @param {*} updatedVMOs : list of updated VMOs
 */
let findReusedAssemblyInAllCollapsedNodes = function( vmo, updatedVMOs ) {
    if ( vmo.__expandState ) {
        findSelectedObjectAndReusedAssembly( vmo.__expandState.expandedNodes, updatedVMOs );
    }
};

let checkIfNewImportIsEnabled = function() {
    let preferenceValues = appCtxSvc.getCtx( 'preferences' );
    return Boolean( preferenceValues.EnableNewAwp0XlsImport && preferenceValues.EnableNewAwp0XlsImport[0] === 'true' );
};

/**
 * API takes collection of VMOs from caller and searches for reused line in that collection. If
 * found then it adds it to the list of selected vmo list
 * @param {*} loadedVMOs array of elements in which we need to find reused assembly
 * @param {*} updatedVMOs list of reused nodes in the tree
 */
let findSelectedObjectAndReusedAssembly = function( loadedVMOs, updatedVMOs ) {
    let selectedObjs = appCtxSvc.getCtx( 'mselected' );
    _.forEach( selectedObjs, function( selectedObj ) {
        _.forEach( loadedVMOs, function( vmo )  {
            let newActionLabel = localBundle.aceImportPreviewNewAction;
            if ( checkIfNewImportIsEnabled() ) {
                if( !_.isUndefined( selectedObj.props ) && !_.isUndefined( selectedObj.props.preview_action )
                    && selectedObj.props.preview_action.uiValue !== newActionLabel ) {
                    if ( selectedObj.uid && vmo.props && selectedObj.props
                        && criteriaForReusedAssembly( selectedObj, vmo ) ) {
                        updatedVMOs.push( vmo );
                    }
                    findReusedAssemblyInAllCollapsedNodes( vmo, updatedVMOs );
                }
            // TO DO: Remove when porting to 2512
            } else {
                if( !_.isUndefined( selectedObj.props ) && !_.isUndefined( selectedObj.props[localBundle.actionColumn] )
                    && selectedObj.props[localBundle.actionColumn].uiValue !== newActionLabel ) {
                    if ( selectedObj.uid && vmo.props && selectedObj.props
                        && criteriaForReusedAssembly( selectedObj, vmo ) ) {
                        updatedVMOs.push( vmo );
                    }
                    findReusedAssemblyInAllCollapsedNodes( vmo, updatedVMOs );
                }
            }
        } );
    } );
};

/**
 * API searches selected object in loaded VMOs collapsed nodes cache and creates a list of
 * nodes and returns it.
 */
let getSelectedObjectAndItsReusedAssemblyNodes = function() {
    let updatedVMOs = [];
    let loadedVMOs = appCtxSvc.getCtx( 'aceActiveContext.context.vmc.loadedVMObjects' );
    if( loadedVMOs ) {
        findSelectedObjectAndReusedAssembly( loadedVMOs, updatedVMOs );
    }
    return updatedVMOs;
};

/**
 * This API is setting new ui value on property object vmo.
 * @param {ViewModelObject} vmoProperty property object whose display need to be updated
 * @param {*} newValue new UI Value
 */
let updateDisplayValues = function( vmoProperty, newValue ) {
    vmoProperty.dbValue = [ newValue ];
    uwPropertySvc.updateDisplayValues( vmoProperty, [ newValue ] );
};

/**
 * Pushes the node in changed VMO list if it is not already not part of the list.
 * @param {*} selectedVMOs : selected VMO
 */
let updateChangedNodeList = function( selectedVMOs ) {
    if( selectedVMOs.length > 0 ) {
        let isNewImportEnabled = checkIfNewImportIsEnabled();
        if ( isNewImportEnabled ) {
            _.forEach( selectedVMOs, function( selectedVMO ) {
                let itemIDValue;
                if ( selectedVMO.item_id ) {
                    itemIDValue = selectedVMO.item_id;
                }
                let objToStore = {
                    id: itemIDValue,
                    rowId: selectedVMO.uid,
                    action: selectedVMO.props.preview_action.uiValue,
                    internalActionName: selectedVMO.internalActionName
                };
                changedVMOList[ itemIDValue ] = objToStore;
            } );
        // TO DO: Remove when porting to 2512
        } else {
            let idDFieldMappedToItem = getPropFieldForID();
            _.forEach( selectedVMOs, function( selectedVMO ) {
                if( selectedVMO.props && !_.isUndefined( selectedVMO.props[idDFieldMappedToItem] ) ) {
                    let itemRevisionUID = selectedVMO.props[idDFieldMappedToItem].uiValue;
                    let objToStore = {
                        id: selectedVMO.props[idDFieldMappedToItem].uiValue,
                        rowId: selectedVMO.uid,
                        action: selectedVMO.props[localBundle.actionColumn].uiValue,
                        internalActionName: selectedVMO.internalActionName
                    };
                    changedVMOList[ itemRevisionUID ] = objToStore;
                }
            } );
        }
    }
};

export let clearUpdateVMOList = function() {
    changedVMOList = [];
};

/**
 * Returns locale specific action string's value
 * @param {*} actionString : Action String
 */
let getActionString = function( actionString ) {
    switch( actionString ) {
        case 'Overwrite':
            return localBundle.aceImportPreviewOverwriteContentMenu;
        case 'Reference':
            return localBundle.aceImportPreviewReferenceContentMenu;
        case 'Revise':
            return localBundle.aceImportPreviewReviseContentMenu;
    }
};

/**
 * API takes the selected object finds it reused instances and sets action on those lines.
 * @param {*} actionString : Action we want to set on line
 */
export let setActionOnLine = function( actionString ) {
    let selectedVMOs = getSelectedObjectAndItsReusedAssemblyNodes();
    let isNewImportEnabled = checkIfNewImportIsEnabled();
    _.forEach( selectedVMOs, function( selectedVMO ) {
        let vmoProp = isNewImportEnabled ? selectedVMO.props.preview_action : selectedVMO.props[localBundle.actionColumn];
        let localSpecificActionString = getActionString( actionString );
        // Update internal name of action
        selectedVMO.internalActionName = actionString;
        updateDisplayValues( vmoProp, localSpecificActionString );
    } );
    updateChangedNodeList( selectedVMOs );
    // Event to update Tree Table UI
    eventBus.publish( 'reRenderTableOnClient' );
};

/**
 * It checks whether newly created node in tree is a reused assembly and it has
 * been updated by the user or not. If above condition is satisfied then it updates
 * vmo's action property value.
 * @param {*} vmo : newly created VMO in tree
 */
export let populateActionColumnForReusedAssembly = function( vmo ) {
    let isNewImportEnabled = checkIfNewImportIsEnabled();
    if ( isNewImportEnabled ) {
        let itemIDValue;
        if ( vmo.item_id ) {
            itemIDValue = vmo.item_id;
        }
        if( !_.isUndefined( changedVMOList[itemIDValue] ) ) {
            let cachedObject = changedVMOList[itemIDValue];
            vmo.props.preview_action.uiValue = cachedObject.action;
            vmo.internalActionName = cachedObject.internalActionName;
        }
    // TO DO: Remove when porting to 2512
    } else {
        let mappedIDField = getPropFieldForID();
        if( !_.isUndefined( vmo.props ) && !_.isUndefined( vmo.props[mappedIDField] )
        && !_.isUndefined( vmo.props[mappedIDField].uiValue ) ) {
            let itemRevisionUID = vmo.props[mappedIDField].uiValue;
            if( !_.isUndefined( changedVMOList[itemRevisionUID] ) ) {
                let cachedObject = changedVMOList[itemRevisionUID];
                vmo.props[localBundle.actionColumn].uiValue = cachedObject.action;
                vmo.internalActionName = cachedObject.internalActionName;
            }
        }
    }
};

/**
 * API populates actionInfo map in the SOA input which will be sent to the server
 */
export let populateActionInfoMapForImportSOAInput = function() {
    let isNewImportEnabled = checkIfNewImportIsEnabled();
    let loadedVMOs = appCtxSvc.getCtx( 'aceActiveContext.context.vmc.loadedVMObjects' );
    let actionInfo = {};
    if( loadedVMOs ) {
        _.forEach( loadedVMOs, function( vmo ) {
            if( !_.isUndefined( vmo.props ) ) {
                actionInfo[ vmo.uid ] = isNewImportEnabled ? vmo.props.preview_action.uiValue : vmo.props[localBundle.actionColumn].uiValue;
                if( vmo.__expandState ) {
                    _.forEach( vmo.__expandState.expandedNodes, function( expandedNode ) {
                        if( !_.isUndefined( expandedNode.props ) ) {
                            actionInfo[ expandedNode.uid ] = isNewImportEnabled ? expandedNode.props.preview_action.uiValue : expandedNode.props[localBundle.actionColumn].uiValue;
                        }
                    } );
                }
            }
        } );
    }
    return actionInfo;
};

export default exports = {
    setActionOnLine,
    populateActionColumnForReusedAssembly,
    populateActionInfoMapForImportSOAInput,
    clearUpdateVMOList
};
