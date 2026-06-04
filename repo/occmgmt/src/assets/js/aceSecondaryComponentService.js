import _uwPropSrv from 'js/uwPropertyService';
import cdm from 'soa/kernel/clientDataModel';
import { renderComponent } from 'js/declReactUtils';
import occmgmtTTDataService from 'js/aceTreeTableDataService';
import occmgmtUtils from 'js/occmgmtUtils';
import _ from 'lodash';

var exports = {};

/**
 * Returning Overy Icon component
 * @param {vmo} vmo for secondary component node
 * @Internal
 * */
let _renderOverlayIcon = function( vmo ) {
    if( vmo.typeIconURL ) {
        return (
            <div className='aw-widgets-modelIconContainer'>
                <div className='aw-widgets-modelObjectThumbnail'>
                    <img className='aw-base-icon' src='assets/image/typeSecondaryComponent48.svg' alt={vmo.cellHeader1}/>
                </div>
                <div className='aw-widgets-modelObjectTypeIconOverlaySecComp'>
                    <img className='aw-base-icon' src={vmo.typeIconURL} alt={vmo.cellHeader1}/>
                </div>
            </div>
        );
    }
};
/**
 * Function to register dynamic property policy handler
 * @Internal
 */
export let registerHandlerForOverriddenProperties = function( ) {
    occmgmtTTDataService.registerOverriddenPropertyPolicyHandler( scPropertyHandler );
};

/**Function to add render overlay icon
 * @param {vmo} vmo for secondary component node
 * @param {gridCellImageElement} gridCellImageElement for SC's cell
*/
export let addIconTogridCellImageElement = ( vmo, gridCellImageElement ) => {
    if ( vmo && vmo.props && vmo.props.awb0IsSecondaryComponent && vmo.props.awb0IsSecondaryComponent.dbValue === true  ) {
        let iconContainerElement = document.createElement( 'div' );
        let secondaryComponentIcon = _renderOverlayIcon( vmo );
        renderComponent( secondaryComponentIcon, gridCellImageElement );
        gridCellImageElement.insertBefore( iconContainerElement, gridCellImageElement.lastChild );
    }
};

/**
 * Function to add property policy for secondary component
 * @param {occContext} occContext for secondary component
 * @param {isAddSC} isAddSC to about call for add secondary child usecase
 */
export let addPropertyPolicyForSCIcon = ( occContext, isAddSC ) => {
    if( !occContext.isSCOn || occContext.isSCOn === false  ) {
        occmgmtUtils.updateValueOnCtxOrState( 'isSCOn', true, occContext, true );
        registerHandlerForOverriddenProperties();
    }else{
        //Code comes for toggle off case
        if( !isAddSC ) {
            occmgmtUtils.updateValueOnCtxOrState( 'isSCOn', false, occContext, true );
        }
    }
};

let _secComponentProps = [
    {
        name: 'awb0IsSecondaryComponent'
    },
    {
        name: 'awb0OccType'
    }
];

const scPropertyHandler = {
    key: 'scProperty',
    callbackFunction: ( overriddenPropertyPolicy ) => {
        occmgmtTTDataService.updateOverriddenPropertyPolicy( overriddenPropertyPolicy, 'Awb0ConditionalElement', _secComponentProps );
    },
    condition: ( occContext ) => {
        if( !_.isUndefined( occContext ) && occContext.displayToggleOptions && (occContext.isSCOn === true ||
         occContext.displayToggleOptions.PSEShowSecondaryComponentsPref === "true" || occContext.displayToggleOptions.PSEShowSecondaryComponentsPref === true )){
            return true;
        }
        return false;
    }
};

/**
 * Set default value for Secondary Component Type LOV
 * @internal
 */
export let initializeSecondaryComponentTypeValues = ( subPanelContext, secondaryComponentType ) => {
    let allowedPSOccurrenceTypes  = subPanelContext.addElementState.allowedPSOccurrenceTypes;
    let secondaryComponentTypeDisplayNames = [];

    for( let i in allowedPSOccurrenceTypes ) {
        let modelObject = cdm.getObject( allowedPSOccurrenceTypes[i].uid );
        if( modelObject !== undefined && modelObject !== null ) {
            secondaryComponentTypeDisplayNames.push( {
                propInternalValue: allowedPSOccurrenceTypes[i].uid,
                propDisplayValue: modelObject.props.object_string.uiValues[0]
            } );
        }
    }
    secondaryComponentType.update(
        secondaryComponentTypeDisplayNames[0].propInternalValue,
        {
            displayValues: [ secondaryComponentTypeDisplayNames[0].propDisplayValue ],
            displayValueUpdated: true
        } );
    return secondaryComponentTypeDisplayNames;
};

/**
 * Update user-selected secondary component type on subPanelContext
 * @internal
 */
export let setSecondaryComponentTypeOnUpdate = ( subPanelContext, secondaryComponentType ) => {
    let newAddElementState = { ...subPanelContext.addElementState.value };
    let occTypeVMProp = _uwPropSrv.createViewModelProperty( 'occ_type', 'Occurrence Type', 'OBJECT', secondaryComponentType.value, secondaryComponentType.fielddata.uiValues );
    occTypeVMProp.value = secondaryComponentType.value;
    occTypeVMProp.dbValue = secondaryComponentType.value;
    occTypeVMProp.dbValues = [ secondaryComponentType.value ];
    occTypeVMProp.valueUpdated = true;
    newAddElementState.extensionVMProps = {
        ...newAddElementState.extensionVMProps,
        occ_type: occTypeVMProp
    };

    // Proceed only if new selection is different than previous selection
    if( subPanelContext.addElementState.extensionVMProps === undefined || secondaryComponentType.value !== subPanelContext.addElementState.extensionVMProps.occ_type.dbValue ) {
        if( subPanelContext.addPanelState.selectedTab.pageId === 'palette' ) {
            exports.validateSelection( subPanelContext.addElementState, subPanelContext.addPanelState, newAddElementState );
        } else {
            subPanelContext.addElementState.update( newAddElementState );
        }
    }
};

export const validateSelection = ( addElementState, addPanelState, tempAddElementState = { ...addElementState.value } ) => {
    if( tempAddElementState.extensionVMProps === undefined ) {
        return;
    }
    let occTypeFromLOV = tempAddElementState.extensionVMProps.occ_type.uiValue;
    let sourceObjects = addPanelState.value.sourceObjects;
    let disableAdd = false;
    for( let i in sourceObjects ) {
        if(  sourceObjects[i].modelType && sourceObjects[i].modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) {
            if( !sourceObjects[i].props.awb0IsSecondaryComponent || sourceObjects[i].props.awb0IsSecondaryComponent && sourceObjects[i].props.awb0IsSecondaryComponent.dbValues[0] === '0' ) {
                disableAdd = true;
            } else{
                if( !sourceObjects[i].props.awb0OccType || sourceObjects[i].props.awb0OccType && occTypeFromLOV !== sourceObjects[i].props.awb0OccType.uiValues[0] ) {
                    disableAdd = true;
                }
            }
        }
    }
    if( tempAddElementState.disableAdd !== disableAdd || occTypeFromLOV !== addElementState.extensionVMProps.occ_type.uiValue  ) {
        tempAddElementState.disableAdd = disableAdd;
        addElementState.update( tempAddElementState );
    }
};

export default exports = {
    addIconTogridCellImageElement,
    addPropertyPolicyForSCIcon,
    setSecondaryComponentTypeOnUpdate,
    initializeSecondaryComponentTypeValues,
    validateSelection,
    registerHandlerForOverriddenProperties
};
