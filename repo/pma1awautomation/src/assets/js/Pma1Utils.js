// @<COPYRIGHT>@
// ==================================================
// Copyright 2023.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * File to maintain util functions for pma1awautomation module
 *
 * @module js/Pma1Utils
 */
import _ from 'lodash';
import editHandlerService from 'js/editHandlerService';
import dataSourceService from 'js/dataSourceService';
import appCtxService from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import dms from 'soa/dataManagementService';
import AwPromiseService from 'js/awPromiseService';

/**
 * Retrieves the edit handler for the context of design panel.
 *
 * @returns {object} The edit handler for the context of design panel.
 */
const _getEditHandler = () => {
    let editHandler = editHandlerService.getEditHandler( 'REVISE_PANEL_CONTEXT' );
    if ( !editHandler ) {
        editHandler = editHandlerService.getEditHandler( 'CREATE_PANEL_CONTEXT' );
    }
    return editHandler;
};

/**
 * Updates the view model with the given data.
 *
 * @param {object} dataSource - The data source to be updated.
 * @param {object} data - The data to be used for updating the view model.
 * @returns {object} The updated view model.
 */
const _updateViewModel = ( dataSource, data ) => {
    let newViewModel = { ...dataSource.getDeclViewModel() };
    newViewModel.customPanelInfo = newViewModel.customPanelInfo || {};
    newViewModel.customPanelInfo.testPanelId = data;
    return newViewModel;
};

/**
 * Updates the data source with the new view model.
 *
 * @param {object} editHandler - The edit handler to set the new data source.
 * @param {object} newViewModel - The new view model to be set in the data source.
 */
const _updateDataSource = ( editHandler, newViewModel ) => {
    let newDataSource = dataSourceService.createNewDataSource( { declViewModel: newViewModel } );
    editHandler.setDataSource( newDataSource );
};

/**
 * Updates the align property with the given data and subPanelContext.
 *
 * @param {object} data - The data to be used for updating the property.
 * @param {object} subPanelContext - The context of the sub panel.
 * @param {object} property - The property to be updated.
 * @returns {object} The updated property.
 */
export const updateAlignProperty = ( data, subPanelContext, property ) => {
    let editHandler = _getEditHandler();
    if ( editHandler ) {
        let dataSource = editHandler.getDataSource();
        let newViewModel = _updateViewModel( dataSource, data );
        let vmos = subPanelContext.dataProvider.viewModelCollection.getLoadedViewModelObjects();
        property.dbValue = vmos.map( vmo => vmo.uid );
        _updateDataSource( editHandler, newViewModel );
    }
    return property;
};

/**
 * Updates the PMA Associate Part Property.
 *
 * @param {object} data - The data to be used for updating the property.
 * @param {object} subPanelContext - The context of the sub panel.
 * @param {object} property - The property to be updated.
 * @returns {object} The updated property.
 */
export const updatePmaAssociatePartProperty = ( data, subPanelContext, property ) => {
    let editHandler = _getEditHandler();
    if ( editHandler ) {
        let dataSource = editHandler.getDataSource();
        let newViewModel = _updateViewModel( dataSource, data );

        // Update the property dbValue with the associate part number
        property.dbValue = subPanelContext.associatePartNumber;

        // Here we have a compound property named fnd0AssociatedPartNumber.
        // We need to create input for the compound object Fnd0ExtdDesignRevAttrs as part of the addObject4 body request.
        // The CFX code has a handler inside the _processPropertyForCustomPanelInput method.
        // The intermediate compound objects will be used to create input for creating an item for the Custom Panel view model.
        property.intermediateCompoundObjects = {
            revision__Fnd0ExtdDesignRevAttrs:
                {
                    boName: 'Fnd0ExtdDesignRevAttrs',
                    propertyNameValues: {
                        fnd0AssociatedPartNumber: [
                            property.dbValue
                        ]
                    },
                    compoundCreateInput: {},
                    modelType:{ owningType:'Fnd0ExtdDesignRevAttrs' }
                }
        };
        _updateDataSource( editHandler, newViewModel );
    }
    return property;
};

/**
 * Updates the PMA Auto Create Part Number Property.
 *
 * @param {object} data - The data to be used for updating the property.
 * @param {object} subPanelContext - The context of the sub panel.
 * @param {object} property - The property to be updated.
 * @returns {object} The updated property.
 */
export const updatePmaAutoCreatePartNumberProperty = ( data, subPanelContext, property ) => {
    let editHandler = _getEditHandler();
    if ( editHandler ) {
        let dataSource = editHandler.getDataSource();
        let newViewModel = _updateViewModel( dataSource, data );
        property.dbValue = subPanelContext.fields.createPartOption.checked === 'autoCreate';
        _updateDataSource( editHandler, newViewModel );
    }
    return property;
};

/**
 * Updates the defer for later property.
 *
 * @param {object} data - The data to be used for updating the property.
 */
export const updateDeferForLaterProperty = ( data ) => {
    let editHandler = _getEditHandler();
    if ( editHandler ) {
        let dataSource = editHandler.getDataSource();
        let newViewModel = _updateViewModel( dataSource, data );
        _updateDataSource( editHandler, newViewModel );
    }
};

export const getRevisionData = ( dataProvider, createdObject, sourceObjects ) => {
    if( dataProvider ) {
        let allResources = dataProvider.viewModelCollection.loadedVMObjects;
        if( createdObject ) {
            allResources.push( createdObject );
        }
        if( sourceObjects && sourceObjects.length && sourceObjects.length > 0 ) {
            sourceObjects.forEach( sourceObject => {
                var index = _.findIndex( allResources, function( existingObject ) {
                    return sourceObject.uid === existingObject.uid;
                } );

                if ( index === -1 ) {
                    allResources.push( sourceObject );
                }
            } );
        }
        // Update data provider.
        dataProvider.update( allResources );
    }
};

export const removeObjects = ( commandContext ) => {
    const dataProvider = commandContext.context;
    if( dataProvider && dataProvider.viewModelCollection.loadedVMObjects.length > 0 ) {
        const loadedObjects = dataProvider.viewModelCollection.loadedVMObjects;
        const validObjects = _.difference( loadedObjects, [ commandContext.vmo ] );
        dataProvider.update( validObjects, validObjects.length );
    }
};


export const updateCustomPanel = ( subPanelContext, createProperty, requiredProperty, propertyToUpdate ) => {
    if( requiredProperty && createProperty ) {
        if( requiredProperty.value && !createProperty.value ) {
            var vmos = subPanelContext.dataProvider.viewModelCollection.getLoadedViewModelObjects();
            propertyToUpdate.dbValue = [];
            _.forEach( vmos, ( vmo )=>{
                propertyToUpdate.dbValue.push( vmo.uid );
            } );
        }else{
            propertyToUpdate.dbValue = [];
        }
    }
};


export const updateCustomFieldsPanelBasedOnRequiredProperty = ( createProperty, requiredProperty ) => {
    if( requiredProperty ) {
        let  editHandler = editHandlerService.getEditHandler( 'CREATE_PANEL_CONTEXT' );
        if( editHandler ) {
            let dataSource = editHandler.getDataSource();
            let modifiableProps = dataSource.getAllEditableProperties();
            let createPropertyIdx = -1;
            if( modifiableProps.length > 0 ) {
                // case : when creatProperty is removed from Create Stylesheet
                if( createProperty ) {
                    createPropertyIdx = _.findLastIndex( modifiableProps, function( prop ) {
                        return prop.propertyName === createProperty.name;
                    } );
                }

                if( createPropertyIdx > -1 ) {
                    if( !requiredProperty.value )                     {
                        modifiableProps[createPropertyIdx].isEnabled = false;
                        modifiableProps[createPropertyIdx].valueUpdated = false;
                    }else{
                        if( !modifiableProps[createPropertyIdx].isEnabled ) {
                            modifiableProps[createPropertyIdx].isEnabled = true;
                            modifiableProps[createPropertyIdx].valueUpdated = true;
                        }
                    }
                    dataSource.updateObjects( [ modifiableProps[createPropertyIdx] ] );
                }
            }
        }
    }
};

export const updateSubPanel = ( props ) => {
    let editHandler = editHandlerService.getEditHandler( 'CREATE_PART_OR_DESIGN_SUB_PANEL_CONTEXT' );

    // If Part already has Aligned Design then align design panel and vise versa use case should show respective 'Required' and' Automatically Create' checkboxes as disabled
    if( !editHandler && appCtxService.ctx.activeNavigationCommand_dialog && appCtxService.ctx.activeNavigationCommand_dialog.commandId  ) {
        if( appCtxService.ctx.activeNavigationCommand_dialog.commandId === 'CbaAlignPart' || appCtxService.ctx.activeNavigationCommand_dialog.commandId === 'CbaAlignDesign' ) {
            editHandler = editHandlerService.getEditHandler( 'CREATE_PANEL_CONTEXT' );
        }
    }
    let createProperty = getPanelProperty( props.xrtState, [ 'createAlignedDesign', 'createAlignedPart' ] );
    let requiredProperty =  getPanelProperty( props.xrtState, [ 'is_designRequired', 'isDesignRequired', 'is_partRequired', 'isPartRequired' ] );

    // part/design create sub panel should show respective 'Required' and' Automatically Create' checkboxes as disabled
    if( editHandler ) {
        let dataSource = editHandler.getDataSource();
        let modifiableProps = dataSource.getAllEditableProperties();

        if( modifiableProps.length > 0 ) {
            let createPropertyIdx = _.findLastIndex( modifiableProps, function( prop ) {
                return prop.propertyName === createProperty;
            } );
            let requiredPropertyIdx = -1;

            requiredPropertyIdx = _.findLastIndex( modifiableProps, function( prop ) {
                return prop.propertyName === requiredProperty;
            } );

            const propsToBeUpdated = [];
            if( createPropertyIdx > -1 ) {
                modifiableProps[createPropertyIdx].isEnabled = false;
                modifiableProps[createPropertyIdx].valueUpdated = false;
                propsToBeUpdated.push( modifiableProps[createPropertyIdx] );
            }
            if( requiredPropertyIdx > -1 ) {
                modifiableProps[requiredPropertyIdx].value = false;
                modifiableProps[requiredPropertyIdx].dbValue = true;
                modifiableProps[requiredPropertyIdx].isEnabled = false;
                modifiableProps[requiredPropertyIdx].valueUpdated = false;
                propsToBeUpdated.push( modifiableProps[requiredPropertyIdx] );
            }


            if( propsToBeUpdated.length > 0 ) {
                dataSource.updateObjects( propsToBeUpdated );
            }
        }
    }
};

const endsWithAny = function( suffixes, string ) {
    return suffixes.some( function( suffix ) {
        return string.toLowerCase().endsWith( suffix.toLowerCase() );
    } );
};
export const getPanelProperty = ( xrtState, suffixes ) => {
    const props = xrtState.xrtVMO.props;
    let panelProperty = undefined;
    _.forEach( props, function( property ) {
        const propertyName = property.name.toLowerCase();
        if( endsWithAny( suffixes, propertyName ) ) {
            panelProperty = property;
        }
    } );
    return panelProperty ? panelProperty.name : panelProperty;
};


export const getPrefferedType = ( prefferedType, inputType ) => {
    // inputType will be undefined when we do Design revise irrespective of inside/outside ACE
    let deferred = AwPromiseService.instance.defer();
    if( !inputType ) {
        let awb0UnderlyingObject = appCtxService.getCtx( 'selected' );
        let underlyingObjectDbValue = appCtxService.getCtx( 'selected.props.awb0UnderlyingObject.dbValues[0]' );
        awb0UnderlyingObject = underlyingObjectDbValue ? cdm.getObject( underlyingObjectDbValue ) : awb0UnderlyingObject;
        if( awb0UnderlyingObject ) {
            if( awb0UnderlyingObject.props.items_tag ) {
                let items_tag = cdm.getObject( awb0UnderlyingObject.props.items_tag.dbValues[0] );
                if( items_tag ) {
                    inputType = items_tag.type;
                }
            }else{
                return dms.getProperties( [ awb0UnderlyingObject.uid ], [ 'items_tag'  ] ).then( function( ) {
                    var items_tag = cdm.getObject( awb0UnderlyingObject.props.items_tag.dbValues[0] );
                    let type = undefined;
                    if( items_tag ) {
                        inputType = items_tag.type;
                        type =  _getPrefferedTypeInternal( prefferedType, inputType );
                    }
                    deferred.resolve( type );
                    return deferred.promise;
                } );
            }
        }
    }

    let type =  _getPrefferedTypeInternal( prefferedType, inputType );
    if( !type ) {
        type = prefferedType;
    }
    deferred.resolve( type );
    return deferred.promise;
};


export const _getPrefferedTypeInternal = ( prefferedType, inputType ) => {
    let partAndDesignTypes = appCtxService.ctx.preferences.Pma0_Part_Design_Type;
    let type = undefined;
    if( partAndDesignTypes ) {
        _.forEach( partAndDesignTypes, ( partAndDesignType )=>{
            if( partAndDesignType.includes( inputType ) && partAndDesignType.includes( ',' ) && partAndDesignType.includes( ':' ) ) {
                let types = partAndDesignType.split( ',' );
                if( types.length === 2 && types[0].includes( ':' ) && types[1].includes( ':' ) ) {
                    let partType = types[0].split( ':' )[1];
                    let designType = types[1].split( ':' )[1];
                    if( inputType === partType ) {
                        type = designType;
                        return;
                    }
                    if( inputType === designType ) {
                        type = partType;
                        return;
                    }
                }
            }
        } );
    }
    if( !type ) {
        type = prefferedType;
    }
    return type;
};


export const disabelRevisePanelFields = ( selectedObject ) => {
    let awb0UnderlyingObject = cdm.getObject( selectedObject.uid );

    let requiredProperty = undefined;
    for( let key in awb0UnderlyingObject.props ) {
        if( endsWithAny( [ 'ispartRequired', 'is_partrequired' ], key ) &&  ( awb0UnderlyingObject.props[key].dbValues[0] === 'false' || awb0UnderlyingObject.props[key].dbValues[0] === '0' ) ) {
            requiredProperty = key;
            break;
        }
    }

    let  editHandler = editHandlerService.getEditHandler( 'REVISE_PANEL_CONTEXT' );
    if( requiredProperty && editHandler ) {
        let dataSource = editHandler.getDataSource();
        let modifiableProps = dataSource.getAllEditableProperties();
        if( modifiableProps.length > 0 ) {
            let pma0KeepExistingPartIdx = _.findLastIndex( modifiableProps, function( prop ) {
                return prop.propertyName === 'pma0KeepExistingPart';
            } );
            if( pma0KeepExistingPartIdx > -1 ) {
                modifiableProps[pma0KeepExistingPartIdx].value = false;
                modifiableProps[pma0KeepExistingPartIdx].isEnabled = false;
                modifiableProps[pma0KeepExistingPartIdx].valueUpdated = false;
                dataSource.updateObjects( [ modifiableProps[pma0KeepExistingPartIdx] ] );
            }
        }
    }
};

/**
 * Updates the associate part number based on the required property.
 *
 * @param {object} subPanelContext - The context of the sub panel.
 * @param {object} requiredProperty - The property that determines if the update is required.
 * @param {object} propertyToUpdate - The property to be updated.
 */
export const updateAssociatePartNoBasedOnRequiredProperty = ( subPanelContext, requiredProperty, propertyToUpdate ) => {
    propertyToUpdate.dbValue = requiredProperty?.value ? subPanelContext.associatePartNumber : [];
};

/**
 * Clears the PMA associated part number property.
 *
 * @param {object} data - The data to be used for clearing the property.
 */
export const clearAssociatePartNumberProperty = ( data )=>{
    if( data?.pmaAssignPartIdTextBox ) {
        data.pmaAssignPartIdTextBox.dbValue = '';
    }
};
const exports = {
    getRevisionData,
    removeObjects,
    updateAlignProperty,
    updateCustomPanel,
    updateCustomFieldsPanelBasedOnRequiredProperty,
    getPanelProperty,
    updateSubPanel,
    getPrefferedType,
    disabelRevisePanelFields,
    updatePmaAssociatePartProperty,
    updatePmaAutoCreatePartNumberProperty,
    updateAssociatePartNoBasedOnRequiredProperty,
    updateDeferForLaterProperty,
    clearAssociatePartNumberProperty

};

export default exports;

