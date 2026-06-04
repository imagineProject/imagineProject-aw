// Copyright (c) 2022 Siemens

/**
 * @module js/propertyGroupsService
 */
import _ from 'lodash';
import localeSvc from 'js/localeService';
import cdm from 'soa/kernel/clientDataModel';
import listBoxService from 'js/listBoxService';
import uwPropertyService from 'js/uwPropertyService';
import addObjectUtils from 'js/addObjectUtils';

/**
 * This function is to process and construct the error message with reason for failure while deleting property groups.
 * @param {object} response with partial information
 */
export let constructErrorMessageForPropertyGroups = function( response ) {
    var message = '';
    var resource = 'AccessmgmtConstants';
    var localTextBundle = localeSvc.getLoadedText( resource );
    if( response && response.partialErrors ) {
        _.forEach( response.partialErrors, function( partErr ) {
            var propertyGroupsObject = cdm.getObject( partErr.uid );
            var name = propertyGroupsObject.props.fnd0AlsGroupName.uiValues[ 0 ];
            var errMessage = localTextBundle.propertyGroupsMultipleFailureMessages.replace( '{0}', name );
            //errMessge = 'Group' cannot be deleted for the following reason:
            for( var idx = 0; idx < partErr.errorValues.length; idx++ ) {
                var errVal = partErr.errorValues[ idx ];

                errMessage = errMessage.replace( '{1}', '\n' + errVal.message );
                // errMessge = 'Group' cannot be deleted for the following reason:
                // property group is referenced in another object

                message += '\n' + errMessage;
                //errMessge = 'Group' cannot be deleted for the following reason:
                // property group is referenced in another object
            }
            // errMessge = 'Group' cannot be deleted for the following reason:
            // property group is referenced in another object
            // 'Group' cannot be deleted for the following reason:
            // property group is referenced in another object
        } );
    }

    return message;
};

/**
 * This method will call on selection change & cancelEdit.
 * This method will set the properties to fnd0AlsGroupProperties from subPanelContext.
 * This method attached dataprovider to the ALS Group Properties and make it editable.
 * @param {*} subPanelContext
 * @param {*} alsGroupProperty
 */
export let setPropAttributes = function( subPanelContext, data ) {
    var newAlsGroupProperty = { ...data.fnd0AlsGroupProperties };
    uwPropertyService.setValue( newAlsGroupProperty, [ ...subPanelContext.selected.props.fnd0AlsGroupProperties.dbValues ] );
    uwPropertyService.setDisplayValue( newAlsGroupProperty, [ ...subPanelContext.selected.props.fnd0AlsGroupProperties.dbValues ] );
    uwPropertyService.updateViewModelProperty( newAlsGroupProperty );
    data.dispatch( { path: 'data.fnd0AlsGroupProperties', value: newAlsGroupProperty } );
};

/**
 * This method will call on mount of als group properties summary .
 * This method will set the setPropParentUid to fnd0AlsGroupProperties from subPanelContext.
 * @param {*} subPanelContext
 * @param {*} alsGroupProperty
 */
export let setPropParentUid = function( subPanelContext, data ) {
    var newAlsGroupProperty = { ...data.fnd0AlsGroupProperties };
    uwPropertyService.setSourceObjectUid( newAlsGroupProperty, subPanelContext.selected.props.fnd0AlsGroupProperties.parentUid );
    data.dispatch( { path: 'data.fnd0AlsGroupProperties', value: newAlsGroupProperty } );
};

/**
 * This function is called when click on summary button
 * This function is used to set sourceObjectLastSavedDate to fnd0AlsGroupProperties which is need for saveViewModelEditAndSubmitWorkflow2 soa
 * setting from fnd0AlsGroupName sourceObjectLastSavedDate
 * @param {*} subPanelContext
 * @param {*} fnd0AlsGroupProperties
 * @returns updated fnd0AlsGroupProperties
 */
export let setPropsLsd = function( subPanelContext, fnd0AlsGroupProperties ) {
    var newAlsGroupProperty = { ...fnd0AlsGroupProperties };
    let newXrtState = { ...subPanelContext.xrtState.getValue() };
    newAlsGroupProperty.sourceObjectLastSavedDate = newXrtState.xrtVMO.props.fnd0AlsGroupName.sourceObjectLastSavedDate;
    return newAlsGroupProperty;
};

/**
 * This method is used to get the LOV values for 'propertyGroupType' & 'propertyGroupProperties' LOVs
 * @param {Object} response - the response of the performSearchViewModel SOA
 * @param {string} propertyName - The Property name used for creating LOV object
 */
export let getLovObjects = function( response, propertyName ) {
    const lovObjectsToReturn = [];
    if ( response.ServiceData.plain ) {
        const modelObjects = cdm.getObjects( response.ServiceData.plain );
        const modelObjectsPropertyInfo = modelObjects.filter( obj => obj.type === 'PropertyInfo' );
        const modelObjectsImanType = modelObjects.filter( obj => obj.type === 'ImanType' );

        const processModelObjects = ( objects, propName ) => {
            const lovObjects = listBoxService.createListModelObjects( objects, 'props.' + propName );
            lovObjects.forEach( ( lovObj, index ) => {
                lovObj.propInternalValue = objects[index].props[propName].dbValues[0];
                lovObj.propDisplayValue = objects[index].props[propName].dbValues[0];
                lovObj.propDisplayDescription = objects[index].props[propName].uiValues[0];
                lovObjectsToReturn.push( lovObj );
            } );
        };

        /* This is to display relation properties in "Properties" LOV under #Am0AddPropertyGroup panel.
        All other properties have type as PropertyInfo and thier modelObject contains property_name attribute in props but,
        relation properties have type as "ImanType" and their modelObject contains type_name attribute in props.
        If SOA provider returns mixed types (PropertyInfo + ImanType) in response, we want to display both of them under LOV values in UI
        */

        // Keep this if condition 1st as, relation property names are in upper case and they should appear above persistent properties with lower case names in "Properties" LOV
        if ( modelObjectsImanType.length > 0 ) {
            processModelObjects( modelObjectsImanType, 'type_name' );
        }

        if ( modelObjectsPropertyInfo.length > 0 ) {
            processModelObjects( modelObjectsPropertyInfo, propertyName );
        }
    }
    return lovObjectsToReturn;
};

/**
 * populate unlinkAndDelete input data
 * @param {OBJECTARRAY } selectedObjects - user selected objects
 * @return {input} input data of unlink and delete object
 */
export let unlinkAndDelete = function( selectedObjects ) {
    var input = [];
    var deleteInputData = {};

    for( var i = 0; i < selectedObjects.length; i++ ) {
        deleteInputData = {
            container: '',
            objectsToDelete: [ selectedObjects[ i ] ],
            property: '',
            unlinkAlways: false
        };
        input.push( deleteInputData );
    }
    return input;
};
/**
 * Method to process response and return a combined error message
 * @param  {Object}  response - response from SOA
 */
export let processPartialErrors = function( response ) {
    var message = '';
    if( response && response.ServiceData.partialErrors ) {
        _.forEach( response.ServiceData.partialErrors, function( partialError ) {
            _.forEach( partialError.errorValues, function( object ) {
                message += '<BR/>';
                message += object.message;
            } );
        } );
    }
    return message;
};

/**
 * Method to reset propertyGroupProperties LOV
 * @param  {Object}  prop - view model property
 */
export let resetPropLOV = function( prop ) {
    let newProp = _.clone( prop );
    newProp.displayValues = [];
    newProp.uiValue = '';
    newProp.dbValue = [];
    newProp.dbValues = [];
    newProp.uiValues = [];
    newProp.dbOriginalValue = [];
    return newProp;
};
/**
 * Method to reset create property group panel data in pinned case
 * @param  {object}  data - The view model data object
 */
export let resetPropertyGroupsPanelData = function( data ) {
    let propertyGroupName = Object.assign( {}, data.propertyGroupName );
    let propertyGroupType = Object.assign( {}, data.propertyGroupType );
    let propertyGroupProperties = Object.assign( {}, data.propertyGroupProperties );

    propertyGroupName.dbValue = '';
    propertyGroupName.uiValue = '';

    propertyGroupType.dbValue = '';
    propertyGroupType.uiValue = '';
    propertyGroupType.dbOriginalValue = '';

    propertyGroupProperties.dbValue = [];
    propertyGroupProperties.uiValue = [];

    return {
        propertyGroupName,
        propertyGroupType,
        propertyGroupProperties
    };
};

/**
 * This function will add the newly created property groups in list.
 * And add it on top in primary work area and selects.
 * @param {dataProvider}  dataProvider - primary work area data provider which needs to be updated
 * @param {object} eventData - response of SOA which contains the newly created property groups
 *
 */
export let addPropertyGroupsToProvider = function( dataProvider, eventData, searchState ) {
    var uid = eventData.response.created[ 0 ];
    var newPropertyGroup = eventData.response.modelObjects[ uid ];
    if( newPropertyGroup ) {
        dataProvider.viewModelCollection.loadedVMObjects.unshift( newPropertyGroup );
        dataProvider.update( dataProvider.viewModelCollection.loadedVMObjects, dataProvider.viewModelCollection.loadedVMObjects.length );
        dataProvider.selectionModel.setSelection( newPropertyGroup );
    }
    if( searchState && searchState.update ) {
        let newSearchState = { ...searchState.value };
        newSearchState.totalFound = dataProvider.viewModelCollection.totalFound;
        if( searchState.update ) {
            searchState.update( newSearchState );
        }
    }
};

/**
 * this function is called on change for property group name  and properties value which is used to update atomic data varible isValidTosave for disabling save button
 * @param {Object} props
 * @param {Object} searchState atomic data
 */
export let updateSearchStateForPropertyGroup = function( props, searchState ) {
    if( props.fnd0AlsGroupName.error || props.fnd0AlsGroupProperties.value.length === 0 ) {
        addObjectUtils.updateAtomicDataValue( searchState, { isValidTosave: false } );
    } else {
        addObjectUtils.updateAtomicDataValue( searchState, { isValidTosave: true } );
    }
};

/**
 * Initialize search state with isValidTosave to true
 * @param {*} searchStateAtomicDataRef search state
 * @param {*} searchStateUpdater dispatcher
 */
export let initializeIsValidTosaveInSearchState = function( searchStateAtomicDataRef, searchStateUpdater ) {
    let searchState = searchStateAtomicDataRef.getAtomicData();
    let newSearchstate = searchState ? { ...searchState } : {};

    newSearchstate.isValidTosave = true;
    searchStateUpdater.searchState( newSearchstate );
    return newSearchstate;
};

const exports = {
    constructErrorMessageForPropertyGroups,
    setPropAttributes,
    setPropsLsd,
    getLovObjects,
    unlinkAndDelete,
    processPartialErrors,
    resetPropLOV,
    resetPropertyGroupsPanelData,
    addPropertyGroupsToProvider,
    setPropParentUid,
    updateSearchStateForPropertyGroup,
    initializeIsValidTosaveInSearchState
};
export default exports;
