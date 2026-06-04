// Copyright (c) 2022 Siemens

/**
 * @module js/Am0AclTableService
 */
import editHandlerService from 'js/editHandlerService';
import uwPropertyService from 'js/uwPropertyService';
import tcViewModelObjectSvc from 'js/tcViewModelObjectService';
import awColumnSvc from 'js/awColumnService';
import localeSvc from 'js/localeService';
import AwPromiseService from 'js/awPromiseService';
import messagingService from 'js/messagingService';
import soaSvc from 'soa/kernel/soaService';
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';
import cdm from 'soa/kernel/clientDataModel';
import listBoxService from 'js/listBoxService';
var _localTextBundle = localeSvc.getLoadedText( 'AccessmgmtConstants' );

//object acl table columns
var cols = [];
const allow = 'Allow';
const deny = 'Deny';

/**
 * The functions is being used to initialize the acl property with the props.aclProp passed by the consumer
 * @param {*} data namedAcl table viewModel
 * @param {*} aclProp props.aclProp
 */
export let loadAclProp = function( data, aclProp, isEditing ) {
    var acl = { ...data.acl };
    acl.isEditable = isEditing;
    if( aclProp ) {
        acl.dbValue = aclProp.dbValue;
        acl.uiValue = aclProp.uiValue;
        acl.dbOriginalValue = aclProp.dbOriginalValue;
    }
    return acl;
};

/**
  * Store aclEntries of dataProvider on change of object acl name
  * This is used for resetPrivilege command and to identify the removed rows from the table while saving it
  * @param {*} loadedVMObjects loadedVMObjects
  * @param {*} namedAclState namedAclState
  */
export let storeAceEntriesFromTable = function( loadedVMObjects, namedAclState, type ) {
    if( namedAclState ) {
        const newNamedAclState = { ...namedAclState.value };
        if( type === 'AM_ACE' ) {
            newNamedAclState.origNamedAclEntries = _.cloneDeep( loadedVMObjects );
        } else if( type === 'fnd0AlsAce' ) {
            newNamedAclState.origNamedAttrAclEntries = _.cloneDeep( loadedVMObjects );
        }
        namedAclState.update && namedAclState.update( newNamedAclState );
    }
};


/**
 * The function is being invoked on startEdit/cancelEdit & saveEdit and it registers and unregisters the preSaveAction
 * @param {*} viewModel named acl table view model
 * @param {*} dataProvider named acl table dataProvider
 * @param {*} namedAclState named acl state
 * @param {*} register true/false to register or unregister the pre-save-action
 */
export let preSaveAction = function( viewModel, dataProvider, namedAclState, aclProp, register, subPanelContext ) {
    var activeEditHandler = editHandlerService.getActiveEditHandler();
    if( viewModel && aclProp && !viewModel.acl.modified && viewModel.acl.dbValue !== aclProp.dbValue ) {
        viewModel.acl.modified = true;
    }
    if( activeEditHandler ) {
        var namedAclPreSaveFunc = function() {
            exports.getModifiedACLEntries(  viewModel.acl, dataProvider, namedAclState, viewModel.isRestrictedWrite, viewModel.defRestrictedRead, viewModel.defRestrictedWrite, viewModel );
        };
        if( register ) { //!viewModel.data.preSaveActionID
            viewModel.data.preSaveActionID = activeEditHandler.registerPreSaveAction( namedAclPreSaveFunc );
        } else if ( !register && viewModel.data.preSaveActionID ) {
            activeEditHandler.unregisterPreSaveAction( viewModel.data.preSaveActionID );
        }
    }
};

/**
 * The function is to validate the acl rows which are being modified. Accessor,AccessorType and atleast on privilege should be set.
 * If any row is not following mandatory cols check will be marked as invalidRow.
 * @param {*} aclEntry acl entry in table
 * @param {*} dataProvider named acl table dataProvider
 */
export let validateAclRows = function( aclEntry,  dataProvider ) {
    var cols = dataProvider.cols;
    var isValidRow = true;
    var inValidPrivileges = true;
    var isEmptyRow = false;
    for( var j = 0; j < cols.length; j++ ) {
        if( cols[ j ].propertyName !== 'Accessor' && cols[ j ].propertyName !== 'AccessorType' ) {
            // check if at least one privilege must be granted or denied
            if( aclEntry.props[cols[j].propertyName].dbValue !== '' ) {
                inValidPrivileges = false;
                break;
            }
        }
    }
    if( aclEntry.type === 'Fnd0AlsAce' ) {
        //These conditions are for Attribute ACE table
        //Only WRITE column not mandotory in Attribute ACE table
        //var emptyPrivilege = aclEntry.props.READ.dbValue === '';
        var isInvalidPrivilege = aclEntry.props.READ.dbValue === '';
        //if(  aclEntry.props.PropertyGroup.dbValue === '' && aclEntry.props.AccessorType.dbValue === '' && aclEntry.props.Accessor.dbValue === '' && emptyPrivilege ) {
        // check for empty row
        //    isEmptyRow = true;
        //} else
        if(  aclEntry.props.PropertyGroup.dbValue === '' || aclEntry.props.AccessorType.dbValue === '' || aclEntry.props.Accessor.dbValue === '' || isInvalidPrivilege ) {
            // check for invalid row
            isValidRow = false;
        }
    } else{
        //These conditions are for Object acl table validation
        if(  aclEntry.props.AccessorType.dbValue === '' && aclEntry.props.Accessor.dbValue === ''  && inValidPrivileges ) {
            // check for empty row
            isEmptyRow = true;
        } else if(  aclEntry.props.AccessorType.dbValue === '' || aclEntry.props.Accessor.dbValue === ''  || inValidPrivileges ) {
            // check for invalid row
            isValidRow = false;
        }
    }
    return {
        isValid:isValidRow,
        isEmpty:isEmptyRow
    };
};


/**
 * This function is called when we click on Apply button in SWA.
 * It gets the updated restricted read/write configuration and creates a attrAclEntry requires to pass the SOA updateAMRuleAndACL2 structure
 * @param {
 * } data
 * @returns aclEntry
 */
export let createRestrictedProtectionEntry = function( aclState ) {
    //Test restricted read/write
    var aclEntry = {
        type:'Fnd0AlsAce',
        props:{
            Accessor:{
                dbValue:'',
                uiValue:''
            },
            PropertyGroup:{
                dbValue:'',
                uiValue:''
            }
        }
    };
    var value = '';
    var updateAclEntry = createUpdateAclEntry( '', '', aclEntry );
    if( aclState.isRestrictedWrite && aclState.isRestrictedWrite.valueUpdated ) {
        value = aclState.isRestrictedWrite.dbValue ? allow : deny;
        updateAclEntry.privileges.push( {
            name: 'RestrictedWrite',
            access: value
        } );
    }
    if( aclState.defRestrictedWrite && aclState.defRestrictedWrite.valueUpdated ) {
        value = aclState.defRestrictedWrite.dbValue ? allow : deny;
        updateAclEntry.privileges.push( {
            name: 'DefaultRestrictedWrite',
            access: value
        } );
    }
    if( aclState.defRestrictedRead && aclState.defRestrictedRead.valueUpdated ) {
        value = aclState.defRestrictedRead.dbValue ? allow : deny;
        updateAclEntry.privileges.push( {
            name: 'DefaultRestrictedRead',
            access: value
        } );
    }

    return updateAclEntry;
};

/**
 * The method is used when Restricted Write is set to true and warning message will appear with Ok & Cancel option.
 * When user click on "Cancel" option this method is invoked and will re-set the restricted write flag to false.
 * @param {*} namedAclState named acl state
 * @param {*} data view model data
 * @returns
 */
export let unsetWriteRestricted = function( namedAclState, data ) {
    var isRW = data.isRestrictedWrite;
    isRW.dbValue = false;

    var newNamedAclState = {};
    if( namedAclState ) {
        newNamedAclState = { ...namedAclState.getValue() };
    }
    if( newNamedAclState ) {
        newNamedAclState.isRestrictedWrite = isRW;
        namedAclState.update && namedAclState.update( newNamedAclState );
    }
    return {
        isRW:isRW
    };
};

/**
 * The method is called when the isRestrictedWrite , defRestrictedWrite and defRestrictedRead checkbox is checked or unchecked.
 * The method will update the namedAclState to track the chanegs in the attribute.
 * @param {*} namedAclState named acl state
 * @param {*} data view model data
 * @param {*} isRestrictedWriteChange if restricted write is changed or not
 * @returns
 */
export let onCheckBoxChange = function(  namedAclState, data, isRestrictedWriteChange ) {
    //Valid combinations are -
    // 1. RW = false , DefRW = true
    // 2. RW = true , DefRW = false
    // 3. RW = false, DefRW = false
    var defRW = data.defRestrictedWrite;
    var isRW = data.isRestrictedWrite;
    if( isRestrictedWriteChange ) {
        if( isRW.dbValue ) {
            // set DefRW to false and mark it disable
            //defRW.dbValue = false;
            //defRW.valueUpdated = true;
            uwPropertyService.setValue( defRW, false );
            uwPropertyService.setDisplayValue( defRW, [ 'False' ] );
        }
    } else{
        if( defRW.dbValue ) {
            // set DefRW to false and mark it disable
            //isRW.dbValue = false;
            //isRW.valueUpdated = true;
            uwPropertyService.setValue( isRW, false );
            uwPropertyService.setDisplayValue( isRW, [ 'False' ] );
        }
    }
    return {
        isRW:isRW,
        defRW:defRW
    };
};

/**
 * This function is called as pre-save action and updates the 'namedAclState' with the updatedAclEntries and errorMessage or invalidRows entries.
 * @param {*} viewModel named acl table view model
 * @param {*} dataProvider named acl table dataprovider
 * @param {*} namedAclState named acl state
 * @returns updateAclEntries,invalidRows,errorMessage
 */
export let getModifiedACLEntries = function( acl, dataProvider, namedAclState, isRestrictedWrite, defRestrictedRead, defRestrictedWrite, data ) {
    var errMessage = '';
    var namedACL = {};
    var newNamedAclState = {};
    var invalidAttrAclEntries = [];
    var invalidRWAttrAclEntries = [];
    var restrictedWriteAccess = '';
    if( namedAclState ) {
        newNamedAclState = { ...namedAclState.getValue() };
    }
    namedACL.acl = acl;
    namedACL.aceInfo = [];
    namedACL.attrAceInfo = [];

    var aceInfoInput = prepareUpdatesSoaInput( dataProvider.objectAccessControlProvider, newNamedAclState.origNamedAclEntries );
    namedACL.aceInfo = aceInfoInput.updates;
    var invalidAclEntries = aceInfoInput.invalidAclEntries;
    var attrAceInfoInput = prepareUpdatesSoaInput( dataProvider.attributeAccessControlProvider, newNamedAclState.origNamedAttrAclEntries );
    namedACL.attrAceInfo = attrAceInfoInput.updates;
    //Add new restricted read write configuration entry in attribute ace list.
    var restrictedRWEntry = createRestrictedProtectionEntry( newNamedAclState );
    if( restrictedRWEntry.privileges.length > 0 ) {
        namedACL.attrAceInfo.push( restrictedRWEntry );
        restrictedWriteAccess = restrictedRWEntry.privileges[0].access;
    }

    invalidAttrAclEntries = attrAceInfoInput.invalidAclEntries;
    invalidRWAttrAclEntries = attrAceInfoInput.invalidRWAclEntires;

    // highlight invalid rows using setSelection and give error message
    if( invalidAclEntries &&  invalidAclEntries.length > 0 ) {
        dataProvider.objectAccessControlProvider.selectionModel.setSelection( invalidAclEntries );
        var objectErrMessage = _localTextBundle.genericInvalidRowMsg;
    }
    var attrErrMessage = '';
    // check if all columns configured for all als ace when restricted write is set to true
    // isRestrictedWrite - if Restricted Write is already set to allow
    // restrictedWriteAccess - if Restricted Write is changed to true
    if( ( isRestrictedWrite && isRestrictedWrite.dbValue === true ||  restrictedWriteAccess === 'Allow' ) && ( invalidRWAttrAclEntries.length > 0 || invalidAttrAclEntries.length > 0 ) ) {
        dataProvider.attributeAccessControlProvider.selectionModel.setSelection( invalidAttrAclEntries );
        dataProvider.attributeAccessControlProvider.selectionModel.addToSelection( invalidRWAttrAclEntries );
        attrErrMessage = _localTextBundle.RWAttrInvalidRowMsg;
    } else if( invalidAttrAclEntries &&  invalidAttrAclEntries.length > 0 ) {
        dataProvider.attributeAccessControlProvider.selectionModel.setSelection( invalidAttrAclEntries );
        attrErrMessage = _localTextBundle.genericAttrInvalidRowMsg;
    }
    if( objectErrMessage && attrErrMessage ) {
        errMessage = objectErrMessage + '\n\n' + attrErrMessage;
    } else if( objectErrMessage ) {
        errMessage = objectErrMessage;
    } else if( attrErrMessage ) {
        errMessage = attrErrMessage;
    }

    if( newNamedAclState ) {
        if( !errMessage ) {
            // change valueUpdated only if there is no attr error message
            if( newNamedAclState.defRestrictedWrite ) {
                newNamedAclState.defRestrictedWrite.valueUpdated = false;
            }
            if( newNamedAclState.defRestrictedRead ) {
                newNamedAclState.defRestrictedRead.valueUpdated = false;
            }
            if( newNamedAclState.isRestrictedWrite ) {
                newNamedAclState.isRestrictedWrite.valueUpdated = false;
            }
        }
        newNamedAclState.updatedAclEntries = namedACL.aceInfo;
        newNamedAclState.updatedAttrEntries = namedACL.attrAceInfo;
        newNamedAclState.errMessage = errMessage;
        newNamedAclState.invalidAclEntries = invalidAclEntries;
        newNamedAclState.invalidAttrAclEntries = invalidAttrAclEntries;
        namedAclState.update && namedAclState.update( newNamedAclState );
    }
};

/**
 * This function is creating Soa updates structure for object acl entries & attribute acl entries
 * @param {*} dataProvider - objectAccessControlProvider/attributeAccessControlProvider
 * @param {*} origNamedAclEntries - Original ACl Entries
 * @returns {object} Updates & invalid acl entries
 */
export let prepareUpdatesSoaInput = function( dataProvider, origNamedAclEntries ) {
    var loadedVMObjects = dataProvider.viewModelCollection.loadedVMObjects;
    var invalidAclEntries = [];
    var namedACL = {};
    var invalidRWAclEntires = [];
    namedACL.updates = [];
    _.forEach( loadedVMObjects, function( aclEntry ) {
        var props = aclEntry.props;
        //if the row is invalid push it to invalidAclEntries
        var aclRowValidation = validateAclRows( aclEntry, dataProvider );
        if( aclEntry.props.WRITE.dbValue === '' ) {
            // mark as invalid entry if Write not defined for als ace
            invalidRWAclEntires.push( aclEntry );
        }
        if( aclRowValidation.isEmpty ) {
            // ignoring blank row for acl entries and validate existing rows
            return;
        }
        if( !aclRowValidation.isValid ) {
            invalidAclEntries.push( aclEntry );
            return; // return in forEach will work same as 'continue' it will skip the current iteration and move to next iteration of loop
        }
        if( aclEntry.isNewEntry ) {
            var updateAcl = createUpdateAclEntry( 'ADD_ACE', aclEntry.props.AccessorType.dbValue, aclEntry );
            updateAcl.privileges = addPrivilegeInUpdate( props );
            namedACL.updates.push( updateAcl );
        } else {
            var accessorModified = false;
            // iterate over the user object
            for ( const key in props ) {
                if( props[key].dirty && ( props[key].propertyName === 'Accessor' || props[key].propertyName === 'AccessorType' ) ) {
                    accessorModified = true;
                    break;
                }
            }

            var privileges = addPrivilegeInUpdate( props );
            //When accessor/PropertyGroup is modified then do remove and add ace action
            if( accessorModified ||  props.PropertyGroup && props.PropertyGroup.dirty  ) {
                var removeAceEntry = createUpdateAclEntry( 'REMOVE_ACE', aclEntry.type, aclEntry );
                namedACL.updates.push( removeAceEntry );
                var addAceEntry = createUpdateAclEntry( 'ADD_ACE', aclEntry.props.AccessorType.dbValue, aclEntry );
                //Usecase - when we modify only accessor, then all privilege should pass as it is to the SOA
                //using a flag(passing true to addPrivilegeInUpdate) to avoid isDirty check on privilege
                addAceEntry.privileges = addPrivilegeInUpdate( props, true );
                namedACL.updates.push( addAceEntry );
            } else if( privileges.length > 0 ) {
                var modifyAceEntry = createUpdateAclEntry( 'MODIFY_ACE', aclEntry.type, aclEntry );
                modifyAceEntry.privileges = privileges;
                namedACL.updates.push( modifyAceEntry );
            }
        }
    } );

    //Get removed acl entry from dataprovider
    var removeAclEntries = origNamedAclEntries.filter( function( o1 ) {
        return !loadedVMObjects.some( function( o2 ) {
            return o1.uid === o2.uid; // return the ones with equal id
        } );
    } );

    //update namedACl updates array for delete entry for soa
    for( var i = 0; i < removeAclEntries.length; i++ ) {
        var aclEntry = removeAclEntries[i];
        var updateAcl = createUpdateAclEntry( 'REMOVE_ACE', aclEntry.type, aclEntry );
        namedACL.updates.push( updateAcl );
    }
    return {
        updates: namedACL.updates,
        invalidAclEntries: invalidAclEntries,
        invalidRWAclEntires: invalidRWAclEntires
    };
};

/**
  * to reset selected privileges in objectACL table to its original value comming from database
  * @param {Object} dataProviders named acl table dataprovider
  * @param {object} namedAclState named acl state
  */
export let resetPrivileges = function( dataProviders, namedAclState ) {
    var storedData = [];
    if( namedAclState ) {
        const newNamedAclState = { ...namedAclState.value };
        storedData = newNamedAclState.origNamedAclEntries;
    }

    var selected = dataProviders.objectAccessControlProvider.selectedObjects;
    var aclEntries = dataProviders.objectAccessControlProvider.viewModelCollection.loadedVMObjects;
    var cols = dataProviders.objectAccessControlProvider.cols;


    for( var i = 0; i < selected.length; i++ ) {
        for( var j = 2; j < cols.length; j++ ) {
            var property = cols[ j ].field;
            var originalEntry = storedData.filter( entry => entry.uid === selected[ i ].uid );
            var index = aclEntries.findIndex( data => data.uid === selected[ i ].uid );

            if( originalEntry.length === 0 ) {
                selected[ i ].props[ property ].iconName = '';
                uwPropertyService.setValue( selected[ i ].props[ property ], '' );
                uwPropertyService.setDisplayValue( selected[ i ].props[ property ], [ '' ] );
            } else {
                var originalPrivAccess = originalEntry[0].props[ property ].dbValue;
                aclEntries[ index ].props[ property ].iconName = originalPrivAccess === '' ? '' : originalPrivAccess === deny ? 'indicatorNo16' : 'indicatorApprovedPass16';
                uwPropertyService.setValue( aclEntries[ index ].props[ property ], originalPrivAccess );
                uwPropertyService.setDisplayValue( aclEntries[ index ].props[ property ], [ originalPrivAccess ] );
            }
        }
    }
    dataProviders.objectAccessControlProvider.update( aclEntries );
};

/**
  * Create updateAcl for soa input
  * @param {*} action -add/remove/modify action
  * @param {*} type - Accesor Type
  * @param {*} uid - Accessor uid
  * @returns updateAcl object
  */
function createUpdateAclEntry( action, type, aclEntry ) {
    if( aclEntry.type === 'Fnd0AlsAce' ) {
        return {
            action: action,
            accessor: {
                type: type,
                uid: action === 'REMOVE_ACE' ? aclEntry.accessorUid : aclEntry.props.Accessor.dbValue
            },
            propertyGrp: {
                type: 'Fnd0AlsGroup',
                uid: action === 'REMOVE_ACE' ? aclEntry.propertyGroupUid : aclEntry.props.PropertyGroup.dbValue
            },
            clientId: 'ALS',
            privileges: []
        };
    }
    return {
        action: action,
        accessor: {
            type: type,
            uid: action === 'REMOVE_ACE' ? aclEntry.accessorUid : aclEntry.props.Accessor.dbValue
        },
        clientId: 'AM',
        privileges: []
    };
}

/**
  * Prepare privileges input for soa
  * privilegeFlag - It is used to avoid isDirty check when only accessor is modified and privilege in not modified.
  * @param {*} props
  * @param {Bolean} privilegeFlag
  * @returns privileges array
  */
function addPrivilegeInUpdate( props, privilegeFlag ) {
    var privileges = [];
    for( const [ propKey, propValue ] of Object.entries( props ) ) {
        var isPrivilgeProperty = propValue.propertyName !== 'PropertyGroup' && propValue.propertyName !== 'Accessor' && propValue.propertyName !== 'AccessorType';
        if( ( propValue.dirty || privilegeFlag && propValue.dbValue !== '' ) && ( isPrivilgeProperty && propValue.renderingHint === 'AmTreeNamedACLLOVComponent' ) ) {
            privileges.push( {
                name: propValue.propertyName,
                access: propValue.dbValue
            } );
        }
    }
    return privileges;
}


/**
 * This function is called when click on edit button
 * This function mark properties editable and update the acl property
 * @param {*} data named acl view model
 */
export let setAclEditable = function(  data, editable ) {
    data.acl.isEditable = editable;
    data.acl.hasLov = true;
    data.acl.dataProvider = 'objectAclNameProvider';
    data.dispatch( { path:'data.acl', value:data.acl } );
};


// Loading the table actions

/**
  * Method for getting the search string for getACL SOA
  * @param {object} filterValue - filter string for getACL method
  */
export let getFilterString = function( filterValue ) {
    //checking filterValue
    var filterString = '';
    if ( filterValue !== null && filterValue !== undefined ) {
        filterString = filterValue;
    }
    return filterString;
};

/**
  * Method for loading the data in list for ObjectACLName for getACLs2 SOA
  * @param {object} response - SOA response for getACL method
  */
export let loadObjectACLNames = function( response ) {
    var outputs = [];
    for ( var i = 0; i < response.acls.length; i++ ) {
        if ( response.acls[i] ) {
            outputs.push(
                {
                    propDisplayValue: response.acls[i].aclDisplayName,
                    propInternalValue: response.acls[i].acl.uid
                }
            );
        }
    }
    return outputs;
};

/**
  * Adds a new row of object-type AM_ACE to the Object ACL Table
  * @param {Object} dataProvider - the data provider for Object ACL Table
  */
export let addACEEntryToTable = function( dataProvider, objectAcl, isRestrictedWrite ) {
    var newTableRow = createNewACEObject( '', dataProvider, objectAcl, isRestrictedWrite );

    var loadedObjects = dataProvider.viewModelCollection.loadedVMObjects;
    loadedObjects.unshift( newTableRow );
    dataProvider.update( loadedObjects, loadedObjects.length );
    dataProvider.selectionModel.setSelection( newTableRow );
};

/**
  *
  * @param {String} type - vmo type in ACL Table
  * @param {Object} selectedAccessors - selected accessor type, Accessors and property group
  */
export let updateCtxAccessors = function( type, selectedAccessors ) {
    if( type === 'Fnd0AlsAce' ) {
        appCtxSvc.updateCtx( 'ATTRIBUTE_ACCESSORS', selectedAccessors );
    }else{
        appCtxSvc.updateCtx( 'SELECTED_ACCESSORTYPES_ACCESSORS', selectedAccessors );
    }
};

/**
  * Removes the selected rows from the Object ACL Table
  * @param {Object} dataProvider - the data provider for Object ACL Table
  */
export let removeACEEntryFromTable = function( dataProvider ) {
    var selectedAccessors = dataProvider.name === 'attributeAccessControlProvider' ? appCtxSvc.getCtx( 'ATTRIBUTE_ACCESSORS' ) : appCtxSvc.getCtx( 'SELECTED_ACCESSORTYPES_ACCESSORS' );
    var selected = dataProvider.selectedObjects;
    var aclEntries = dataProvider.viewModelCollection.loadedVMObjects;
    for ( var i = 0; i < selected.length; i++ ) {
        var objectToRemove = selected[i];
        aclEntries.splice( aclEntries.indexOf( objectToRemove ), 1 );
        if( selectedAccessors.hasOwnProperty( objectToRemove.uid ) ) {
            delete selectedAccessors[objectToRemove.uid];
        }
    }
    if( dataProvider.name === 'attributeAccessControlProvider' ) {
        appCtxSvc.updateCtx( 'ATTRIBUTE_ACCESSORS', selectedAccessors );
    }else{
        appCtxSvc.updateCtx( 'SELECTED_ACCESSORTYPES_ACCESSORS', selectedAccessors );
    }
    dataProvider.update( aclEntries, aclEntries.length );
};
/**
 * This function is called when the Named ACL table is in edit mode.For the selected row, on change of AccessorType column the Accessor column should be cleared.
 * The dbValue will be set based on the getAccessorByType SOA response and the display value will be blank from the eventData.accessorNameInfos[0].accessorDisplayName.
 * Updates the value in data provider selected  row in object acl table.
 * @param {*} eventData - get the accessor soa response
 * @param {*} selected - get the selected accessor for table row from dataProvider
 */
export let clearAccessorCell = function( eventData, data ) {
    //On AccessorType Lov value change in edit mode - Clear the accessor field by setting blank value for display name & internal name for accessor.
    var dataProvider = eventData.selectedRow.type === 'Fnd0AlsAce' ? data.dataProviders.attributeAccessControlProvider : data.dataProviders.objectAccessControlProvider;
    var aclEntries = dataProvider.viewModelCollection.loadedVMObjects;
    var index = aclEntries.findIndex( aclEntry => aclEntry.uid === eventData.selectedRow.uid );
    aclEntries[index].props.Accessor.dbValue = '';
    aclEntries[index].props.Accessor.uiValue = '';
    uwPropertyService.setIsPropertyModifiable( aclEntries[index].props.Accessor, true );
    //when there are no accessor required for the selected accessor type accessor dbvalue is set based on the getAccessorByType SOA response.
    if( eventData.accessorNameInfos[0].accessorDisplayName === '' ) {
        aclEntries[index].props.Accessor.dbValue = eventData.accessorNameInfos[0].accessor.uid;
        uwPropertyService.setIsPropertyModifiable( aclEntries[index].props.Accessor, false );
        var selectedAccessors = eventData.selectedRow.type === 'Fnd0AlsAce' ? appCtxSvc.getCtx( 'ATTRIBUTE_ACCESSORS' ) : appCtxSvc.getCtx( 'SELECTED_ACCESSORTYPES_ACCESSORS' );
        selectedAccessors[eventData.selectedRow.uid].accessor = eventData.accessorNameInfos[0].accessor.uid;
        selectedAccessors[eventData.selectedRow.uid].noAccessor = true;

        updateCtxAccessors( eventData.selectedRow.type, selectedAccessors );
    }
    uwPropertyService.setValue( aclEntries[index].props.Accessor, aclEntries[index].props.Accessor.dbValue );
    uwPropertyService.resetProperty( aclEntries[index].props.Accessor );

    dataProvider.update( aclEntries );
};

/**
  * Method for updating selected accessor types stored in ctx variable on change of accessor type if we clear input value while filtering input lovs
  * @param {object} vmo - vmo props
  */
export let filterValidAccessorType = function( vmo ) {
    if( vmo.props.AccessorType.dbValue === '' ) {
        var selectedAccessors = vmo.type === 'Fnd0AlsAce' ? appCtxSvc.getCtx( 'ATTRIBUTE_ACCESSORS' ) : appCtxSvc.getCtx( 'SELECTED_ACCESSORTYPES_ACCESSORS' );
        if( selectedAccessors.hasOwnProperty( vmo.uid ) ) {
            delete selectedAccessors[vmo.uid].accessorType;
            delete selectedAccessors[vmo.uid].accessor;
        }
        updateCtxAccessors( vmo.type, selectedAccessors );
    }
};

/**
  * Method for updating selected accessors stored in ctx variable on change of accessor if we clear input value while filtering input lovs
  * @param {object} vmo - vmo props
  */
export let filterValidAccessor = function( vmo ) {
    if( vmo.props.Accessor.dbValue === '' ) {
        var selectedAccessors = vmo.type === 'Fnd0AlsAce' ? appCtxSvc.getCtx( 'ATTRIBUTE_ACCESSORS' ) : appCtxSvc.getCtx( 'SELECTED_ACCESSORTYPES_ACCESSORS' );
        if( selectedAccessors.hasOwnProperty( vmo.uid ) ) {
            delete selectedAccessors[vmo.uid].accessor;
        }
        updateCtxAccessors( vmo.type, selectedAccessors );
    }
};

/*
  * Method for updating selected PropertyGroup stored in ctx variable on change of PropertyGroup
  * @param {object} eventData - lovValue eventData for LovValueChanged
  * @param {object} vmo - vmo props
  */
export let filterValidPropertyGroup = function( vmo ) {
    if( vmo.props.PropertyGroup.dbValue === '' ) {
        var selectedAccessors = appCtxSvc.getCtx( 'ATTRIBUTE_ACCESSORS' );
        if( selectedAccessors.hasOwnProperty( vmo.uid ) ) {
            delete selectedAccessors[vmo.uid].propertyGroup;
        }
        updateCtxAccessors( vmo.type, selectedAccessors );
    }
};


/**
  * Method for updating selected accessor types and accessors stored in ctx variable on change of accessor type
  * @param {object} eventData - lovValue eventData for LovValueChanged
  * @param {object} vmo - vmo props
  */
export let updateSelectedAccessorType = function( eventData, props ) {
    var selectedAccessors = props.type === 'Fnd0AlsAce' ? appCtxSvc.getCtx( 'ATTRIBUTE_ACCESSORS' ) : appCtxSvc.getCtx( 'SELECTED_ACCESSORTYPES_ACCESSORS' );
    if( selectedAccessors.hasOwnProperty( props.uid ) ) {
        selectedAccessors[props.uid].accessorType = eventData.lovValue.propInternalValue;
        delete selectedAccessors[props.uid].accessor;
    }else{
        selectedAccessors[props.uid] = { accessorType : eventData.lovValue.propInternalValue };
    }
    updateCtxAccessors( props.type, selectedAccessors );
};

/**
  * Method for updating selected accessor types and accessors stored in ctx variable on change of accessor
  * @param {object} eventData - lovValue eventData for LovValueChanged
  * @param {object} vmo - vmo props
  */
export let updateSelectedAccessors = function( eventData, props ) {
    var selectedAccessors = props.type === 'Fnd0AlsAce' ? appCtxSvc.getCtx( 'ATTRIBUTE_ACCESSORS' ) : appCtxSvc.getCtx( 'SELECTED_ACCESSORTYPES_ACCESSORS' );
    if( selectedAccessors.hasOwnProperty( props.uid ) ) {
        selectedAccessors[props.uid].accessor = eventData.lovValue.propInternalValue;
    }
    updateCtxAccessors( props.type, selectedAccessors );
};

/*
  * Method for updating selected PropertyGroup stored in ctx variable on change of PropertyGroup
  * @param {object} eventData - lovValue eventData for LovValueChanged
  * @param {object} vmo - vmo props
  */
export let updateSelectedPropertyGroup = function( eventData, props ) {
    var selectedAccessors = appCtxSvc.getCtx( 'ATTRIBUTE_ACCESSORS' );
    if( selectedAccessors.hasOwnProperty( props.uid ) ) {
        selectedAccessors[props.uid].propertyGroup = eventData.lovValue.propInternalValue;
    }else{
        selectedAccessors[props.uid] = { propertyGroup : eventData.lovValue.propInternalValue };
    }
    updateCtxAccessors( 'Fnd0AlsAce', selectedAccessors );
};

/**
  * to update privileges in objectACL table (Allow all and Deny all)
  * @param {Object} dataProvider -  named acl table dataprovider
  * @param {object} access - allow/deny
  */
export let updatePrivileges = function( dataProviders, access ) {
    var selected = dataProviders.objectAccessControlProvider.selectedObjects;
    var aclEntries = dataProviders.objectAccessControlProvider.viewModelCollection.loadedVMObjects;
    var cols = dataProviders.objectAccessControlProvider.cols;

    for ( var i = 0; i < selected.length; i++ ) {
        var index = aclEntries.findIndex( data => data.uid === selected[i].uid );
        for ( var j = 2; j < cols.length; j++ ) {
            var property = cols[j].field;
            aclEntries[ index ].props[ property ].iconName = access === '' ? '' : access === deny ? 'indicatorNo16' : 'indicatorApprovedPass16';
            uwPropertyService.setValue( aclEntries[index].props[property], access );
            uwPropertyService.setDisplayValue( aclEntries[index].props[property], [ access ] );
        }
    }
    dataProviders.objectAccessControlProvider.update( aclEntries );
};

/**
  * Process accessor types to display as a LOV for the SOA getAccessorType
  *
  * @param {Object} response getAccessorType SOA reponse
  * @return {accessorTypes} to be displayed as a LOV
  */
export let getAccessorTypeInfoName = function( response, vmo ) {
    var selectedAccessors = vmo.type === 'Fnd0AlsAce' ? appCtxSvc.getCtx( 'ATTRIBUTE_ACCESSORS' ) : appCtxSvc.getCtx( 'SELECTED_ACCESSORTYPES_ACCESSORS' );
    var accessors = response.accessorTypes;
    var accessorTypes = [];
    //to display accessor types as a lov displayName and internalName assigning to propDisplayValue & propInternalValue
    _.forEach( accessors, function( values ) {
        if ( values ) {
            var typeObjects = {
                propDisplayValue: values.displayName,
                propInternalValue: values.accessorTypeName
            };
            accessorTypes.push( typeObjects );
        }
    } );

    var accessorTypesToBefiltered = [];
    if( vmo.type === 'Fnd0AlsAce' ) {
        // Do not list the accessor type (with no accesor) which is already added in the acl table.
        //If Row - AccessorType approver is already added than for a new row, then remove from accessortype list.
        Object.keys( selectedAccessors ).forEach( function( key ) {
            // ?. is chaining operator which will check first vmo.props.PropertyGroup is not undefined then checks dbValue
            if( selectedAccessors[key].propertyGroup === vmo.props.PropertyGroup?.dbValue && selectedAccessors[key].noAccessor ) {
                accessorTypesToBefiltered.push( selectedAccessors[key].accessorType );
            }
        } );
    } else{
        Object.keys( selectedAccessors ).forEach( function( key ) {
            if( selectedAccessors[key].noAccessor ) {
                accessorTypesToBefiltered.push( selectedAccessors[key].accessorType );
            }
        } );
    }

    var accessorTypeFiltered = accessorTypes.filter( function( obj ) {
        return !accessorTypesToBefiltered.includes( obj.propInternalValue  );
    } );


    // totalFound is assigned on condition based.
    // This is for usecase in which if we search for particular string eg "world" and
    // if it returns records which are less than the accessor types which are already selected in the object acl table i.e. accessorTypesToBefiltered
    // then totalFound should be accessorTypeFiltered otherwise it will set negative totalFound.
    return {
        lovEntries: accessorTypeFiltered,
        totalFound: accessorTypesToBefiltered.length >  response.totalFound ? accessorTypeFiltered.length : response.totalFound - accessorTypesToBefiltered.length
    };
};

/**
  * Process accessors to display as a LOV
  *
  * @param {Object} reponse getAccessorsByType soa response
  * @param {String} accessorType
  * @param {Object} vmo - VMO of modified row
  * @return {accessors} to be displayed as a LOV
  */
export let getAccessorInfoName = function( response, accessorType, vmo ) {
    var accessorValues = response.accessors;
    var accessors = [];
    var selectedAccessors = vmo.type === 'Fnd0AlsAce' ? appCtxSvc.getCtx( 'ATTRIBUTE_ACCESSORS' ) : appCtxSvc.getCtx( 'SELECTED_ACCESSORTYPES_ACCESSORS' );

    //to display accessor as a lov displayName and internalName assigning to propDisplayValue & propInternalValue
    _.forEach( accessorValues, function( values ) {
        if ( values ) {
            var accessorObjects = {
                propDisplayValue: values.accessorDisplayName,
                propInternalValue: values.accessor.uid
            };
            accessors.push( accessorObjects );
        }
    } );

    var accessorsToBefiltered = [];
    if( vmo.type === 'Fnd0AlsAce' ) {
        // Do not list the accessor which is already added in the acl table.
        //If Row - propertyGroup:Group:4G Tester is already added than for a new row, propertyGroup:Group:4G tester is not allowed.
        //4G Tester will be filtered out and will not be displayed in the accessor list.
        Object.keys( selectedAccessors ).forEach( function( key ) {
            if( selectedAccessors[key].propertyGroup === vmo.props.PropertyGroup?.dbValue && selectedAccessors[key].accessorType === accessorType && selectedAccessors[key].accessor ) {
                accessorsToBefiltered.push( selectedAccessors[key].accessor );
            }
        } );
    } else{
        // Do not list the accessor which is already added in the acl table.
        //If Row - Group:4G Tester is already added than for a new row, Group : 4G tester is not allowed. 4G Tester will be filtered out and will not be displayed in the accessor list.
        Object.keys( selectedAccessors ).forEach( function( key ) {
            if( selectedAccessors[key].accessorType === accessorType && selectedAccessors[key].accessor ) {
                accessorsToBefiltered.push( selectedAccessors[key].accessor );
            }
        } );
    }

    var accessorFiltered =  accessors.filter( function( obj ) {
        return !accessorsToBefiltered.includes( obj.propInternalValue  );
    } );

    var filterStr = getFilterString( vmo.props.Accessor.filterString );
    //This will popup All accesssors are consumed warning message.
    //Used (filterStr === '')condition for do not show warning message when we search accessor from list
    //Used (vmo.props.Accessor.dbValue === '') condition for not to show warning message when accessor cell is already filled
    if( accessorFiltered.length === 0 && accessors.length > 0 && filterStr === '' && vmo.props.Accessor.dbValue === '' ) {
        var _localeMsg = _localTextBundle.AM0NoAccessorMessage.replace( '{0}', accessorType );
        var buttons = [ {
            addClass: 'btn btn-notify',
            text: _localTextBundle.OK,
            onClick: function( $noty ) {
                $noty.close();
            }
        } ];
        messagingService.showWarning( _localeMsg, buttons );
    }
    // totalFound is assigned on condition based.
    // This is for usecase in which if we search for particular string eg "ALSGroup1" and
    // if it returns records which are less than the accessors which are already selected in the object acl table i.e. accessorsToBefiltered
    // then totalFound should be accessorFiltered otherwise it will set negative totalFound.
    return {
        lovEntries: accessorFiltered,
        totalFound: accessorsToBefiltered.length >  response.totalFound ? accessorFiltered.length : response.totalFound - accessorsToBefiltered.length
    };
};

/**
  * Gets the columns for ObjectACLTable
  */
export let getViewModelColumns = function() {
    return {
        columns: cols
    };
};

/**
  * Initializes the columns for ObjectACLTable
  * @param {object} response - SOA response for getPrivilegeNames method
  */
export let initColumns = function( response ) {
    var resource = 'AccessmgmtConstants';
    var localTextBundle = localeSvc.getLoadedText( resource );
    cols.push( awColumnSvc.createColumnInfo( {
        name: 'AccessorType',
        propertyName: 'AccessorType',
        displayName: localTextBundle.AccessorType,
        width: 150,
        typeName: 'String',
        pinnedLeft: true,
        enableColumnHiding: false,
        enableColumnMenu: false,
        renderingHint: 'AmTreeNamedACLLOVComponent'
    } ) );

    cols.push( awColumnSvc.createColumnInfo( {
        name: 'Accessor',
        propertyName: 'Accessor',
        displayName: localTextBundle.Accessor,
        width: 100,
        typeName: 'String',
        pinnedLeft: true,
        enableColumnHiding: false,
        enableColumnMenu: false,
        renderingHint: 'AmTreeNamedACLLOVComponent'
    } ) );

    for ( var index = 0; index < response.privNameInfos.length; index++ ) {
        var newCol = awColumnSvc.createColumnInfo();
        newCol.displayName = response.privNameInfos[index].displayName;
        newCol.name = response.privNameInfos[index].internalName;
        newCol.propertyName = response.privNameInfos[index].internalName;
        newCol.width = 62;
        newCol.typeName = 'String';
        newCol.enableColumnHiding = false;
        newCol.enableColumnMenu = false;
        newCol.renderingHint = 'AmTreeNamedACLLOVComponent';
        cols.push( newCol );
    }
    return {
        columns: cols
    };
};


/**
  * Method for loading the data in rows of ObjectACLTable
  * ctx vaiable SELECTED_ACCESSORTYPES_ACCESSORS - is used to filter out the Accessortype - accessor combination which are already added in the object acl table
  * @param {object} response - SOA response for getACLEntries method
  * @param {object} acl - acl to which the acl entries are associated
  */
export let loadObjectACLEntries = function( response, dataProvider, objectAcl ) {
    var displayedRows = [];
    var selectedAccessors = {};
    if( response.output && response.output.length > 0 ) {
        var output = response.output[0];
        for ( var j = 0; j < output.ace.length; j++ ) {
            //need to revisit, will pass output.attrAce as aclEntry and process
            var aclEntry = output.ace[j];
            var displayRow = createNewACEObject( aclEntry, dataProvider, objectAcl );
            displayedRows.push( displayRow );
            // register ctx vaiable SELECTED_ACCESSORTYPES_ACCESSORS where we are maintaing the selected accessor type and accessors for each row
            // SELECTED_ACCESSORTYPES_ACCESSORS is used to filter existing accessors from lovs
            var noAccessor = aclEntry.accessorDisplayName === '';
            selectedAccessors[displayRow.uid] = { accessorType : aclEntry.accessorType.accessorTypeName, accessor: aclEntry.accessor.uid, noAccessor: noAccessor };
        }
    }

    if( appCtxSvc.getCtx( 'SELECTED_ACCESSORTYPES_ACCESSORS' ) ) {
        appCtxSvc.updateCtx( 'SELECTED_ACCESSORTYPES_ACCESSORS', selectedAccessors );
    }else{
        appCtxSvc.registerCtx( 'SELECTED_ACCESSORTYPES_ACCESSORS', selectedAccessors );
    }
    return displayedRows;
};

export let populateRestrictedRWCheckboxes = function( aclEntry, data, formProp ) {
    var isRestrictedWrite = false;
    let isRestrictedWriteForReset = { ...data.isRestrictedWrite };
    let defRestrictedReadForReset = { ...data.defRestrictedRead };
    let defRestrictedWriteForReset = { ...data.defRestrictedWrite };

    for ( var i = 0; i < aclEntry.privileges.length; i++ ) {
        var name = aclEntry.privileges[i].name;
        var value = aclEntry.privileges[i].access === 'Allow';
        var dispVal = aclEntry.privileges[i].access === 'Allow' ? 'True' : 'False';

        if( name === 'RestrictedWrite' ) {
            isRestrictedWrite = value;
            isRestrictedWriteForReset.dbValue = value;
            isRestrictedWriteForReset.newDisplayValues = [ dispVal ];
        } else if( name === 'DefaultRestrictedRead' ) {
            defRestrictedReadForReset.dbValue = value;
            defRestrictedReadForReset.newDisplayValues = [ dispVal ];
        } else if( name === 'DefaultRestrictedWrite' ) {
            defRestrictedWriteForReset.dbValue = value;
            defRestrictedWriteForReset.newDisplayValues = [ dispVal ];
        }
    }
    formProp.reset( {
        isRestrictedWrite: isRestrictedWriteForReset,
        defRestrictedWrite: defRestrictedWriteForReset,
        defRestrictedRead: defRestrictedReadForReset
    } );
};

/**
  * Method for loading the data in rows of Attribute ACL Table
  * @param {object} response - SOA response for getACEInfoForACL method
  * @param {object} acl - acl to which the acl entries are associated
  */
export let loadAttributeACLEntries = function( response, dataProvider, data, formProp ) {
    var displayedRows = [];
    var selectedAccessors = {};
    if( response.output && response.output.length > 0 ) {
        var output = response.output[0];
        for ( var i = 0; i < output.attrAce.length; i++ ) {
            var aclEntry = output.attrAce[i];
            //For restricted read/write aclEntry there will not be any accessor type
            // The restricted read/write configuration will be stored in aclEntry privileges structure to load the checkboxes.
            if( aclEntry.accessorType.displayName !== '' ) {
                var displayRow = createNewACEObject( aclEntry, dataProvider, data.acl );
                displayedRows.push( displayRow );
                // register ctx vaiable ATTRIBUTE_ACCESSORS where we are maintaing the selected Property Group, accessor type and accessors for each row
                // ATTRIBUTE_ACCESSORS is used to filter existing accessors from lovs
                var noAccessor = aclEntry.accessorDisplayName === '';
                selectedAccessors[displayRow.uid] = {
                    propertyGroup: aclEntry.attributeGroup?.uid,
                    accessorType : aclEntry.accessorType.accessorTypeName,
                    accessor: aclEntry.accessor.uid, noAccessor: noAccessor
                };
            } else{
                //Populate restricted read/write checkboxes
                populateRestrictedRWCheckboxes( aclEntry, data, formProp );
            }
        }
    }

    if( appCtxSvc.getCtx( 'ATTRIBUTE_ACCESSORS' ) ) {
        appCtxSvc.updateCtx( 'ATTRIBUTE_ACCESSORS', selectedAccessors );
    }else{
        appCtxSvc.registerCtx( 'ATTRIBUTE_ACCESSORS', selectedAccessors );
    }
    return displayedRows;
};
/**
  * Function to create new ACE object to be populated in the Object ACL Table
  *
  * @param {Object} aclEntry - the aclEntries returned from getACLEntries SOA
  * @param {Object} dataProvider - the data provider for Object ACL Table
  * @param {object} acl - acl to which the acl entries are associated
  */
function createNewACEObject( aclEntry, dataProvider, objectAcl ) {
    var newObjectUid = Math.random().toString( 36 ).substr( 2, 10 );
    var newACEObject = tcViewModelObjectSvc.createViewModelObjectById( newObjectUid );
    newACEObject.type = dataProvider.name === 'attributeAccessControlProvider' ? 'Fnd0AlsAce' : 'AM_ACE';

    if ( aclEntry ) {
        newACEObject.accessorUid = aclEntry.accessor.uid;
        var attributeGroup = aclEntry.attributeGroup;
        if( attributeGroup ) {
            var modelObjects = cdm.getObject( attributeGroup.uid );
            newACEObject.propertyGroupUid = modelObjects.uid;
            let vmAttrProp = uwPropertyService.createViewModelProperty( 'PropertyGroup', 'PropertyGroup', 'STRING', modelObjects.uid, [ modelObjects.props.fnd0AlsGroupName.uiValues[0] ] );
            uwPropertyService.setSourceObjectUid( vmAttrProp, objectAcl.dbValue );
            uwPropertyService.setHasLov( vmAttrProp, true );
            newACEObject.props[vmAttrProp.propertyDisplayName] = vmAttrProp;
        }
        var accessorName = aclEntry.accessorDisplayName;
        let vmprop1 = uwPropertyService.createViewModelProperty( 'AccessorType', 'AccessorType', 'STRING', aclEntry.accessorType.accessorTypeName, [ aclEntry.accessorType.displayName ] );
        let vmprop2 = uwPropertyService.createViewModelProperty( 'Accessor', 'Accessor', 'STRING', aclEntry.accessor.uid, [ accessorName ] );
        uwPropertyService.setSourceObjectUid( vmprop1, objectAcl.dbValue );
        uwPropertyService.setSourceObjectUid( vmprop2, objectAcl.dbValue );
        uwPropertyService.setHasLov( vmprop1, true );
        uwPropertyService.setHasLov( vmprop2, true );
        if( accessorName === '' ) {
            uwPropertyService.setIsPropertyModifiable( vmprop2, false );
        }
        newACEObject.props[vmprop1.propertyDisplayName] = vmprop1;
        newACEObject.props[vmprop2.propertyDisplayName] = vmprop2;

        for ( var index = 0; index < aclEntry.privileges.length; index++ ) {
            var priv = aclEntry.privileges[index];
            let vmprop = uwPropertyService.createViewModelProperty( priv.name, priv.name, 'STRING', priv.access, [ '' ] );
            uwPropertyService.setSourceObjectUid( vmprop, objectAcl.dbValue );
            uwPropertyService.setHasLov( vmprop, true );
            newACEObject.props[vmprop.propertyDisplayName] = vmprop;
        }
    } else {
        var tableColumns = dataProvider.cols;
        for ( var i = 0; i < tableColumns.length; i++ ) {
            var prop = tableColumns[i];
            let vmprop = uwPropertyService.createViewModelProperty( prop.propertyName, prop.propertyName, 'STRING', '', [ '' ] );
            uwPropertyService.setSourceObjectUid( vmprop, objectAcl.dbValue );
            uwPropertyService.setHasLov( vmprop, true );
            newACEObject.props[vmprop.propertyDisplayName] = vmprop;
            newACEObject.isNewEntry = true;
        }
    }
    return newACEObject;
}

/**
 * this function will be used By Manage ACL panel to pass the correct Acl type to create acl from the manage acl panel.
 * Valid acltype for manage acl component is - RULETREE,SYSTEM,RULEPROJ,WORKFLOW
 * @param {} aclType if 'SYSTEM' acltype is not a valid acl type to CreateACL2 SOA. It should be RULETREE,RULEPROJ,WORKFLOW
 */
export let setCreateAclType = function( aclType ) {
    if( aclType === 'SYSTEM' ) {
        return 'RULETREE';
    }
    return aclType;
};

/**
 * This function is called when the saveACL command is triggered and it will call the updateRuleInfoAndACL SOA to save the changes in table.
 * @param {} namedAclState
 */
export let saveACL = function( namedAclState ) {
    var SOAInputs = [];
    var deferred = AwPromiseService.instance.defer();
    var input = [];
    var newNamedAclState = {};
    if( namedAclState ) {
        newNamedAclState = { ...namedAclState.getValue() };
    }
    var namedAcl = {
        acl:{
            type:'AM_ACL',
            uid:newNamedAclState.updatedAcl.dbValue
        },
        aceInfo:newNamedAclState.updatedAclEntries,
        attrAceInfo:newNamedAclState.updatedAttrEntries
    };
    if( newNamedAclState.errMessage || newNamedAclState.invalidAclEntries &&  newNamedAclState.invalidAclEntries.length > 0
        || newNamedAclState.invalidAttrAclEntries && newNamedAclState.invalidAttrAclEntries.length > 0 ) {
        messagingService.showError( newNamedAclState.errMessage );
        deferred.reject( false );
        return deferred.promise;
    }
    input = {
        ruleInfo: {},
        aclInfo: namedAcl
    };

    SOAInputs.push( {
        input: input
    } );

    if( namedAcl.aceInfo.length > 0 || namedAcl.attrAceInfo.length > 0 ) {
        soaSvc.postUnchecked( 'Internal-AccessManager-2022-12-AwAccessManager', 'updateAMRuleAndACL2',
            SOAInputs[0] ).then( function( response ) {
            // Check if input response is not null and contains partial errors then only
            // create the error object
            if( response && response.partialErrors ) {
                _.forEach( response.partialErrors, function( partErr ) {
                    if( partErr.errorValues ) {
                        // TO avoid display of duplicate messages returned in server response
                        var errMessage = '';
                        var messages = _.uniqBy( partErr.errorValues, 'code' );
                        _.forEach( messages, function( errVal ) {
                            if( errMessage.length === 0 ) {
                                errMessage += '</br>' + errVal.message;
                            } else {
                                errMessage += ' ' + errVal.message + '</br>';
                            }
                        } );
                        messagingService.showError( errMessage );
                        deferred.reject( errMessage );
                    }
                } );
            }
            deferred.resolve( response.updated );
        }, function( error ) {
            if( error ) {
                messagingService.showError( error.message );
            }
            error = null;
            deferred.reject( error );
        } );
    } else {
        deferred.resolve();
    }

    return deferred.promise;
};

/**
 * Remove the emapty rows from table if any
 * @param {} dataProvider
 */
export let removeBlankRows = function( dataProvider ) {
    var loadedVMObjects = dataProvider.viewModelCollection.loadedVMObjects;
    for( var j = 0; j < loadedVMObjects.length; j++ ) {
        var aclRowValidation = validateAclRows( loadedVMObjects[j], dataProvider );
        if( aclRowValidation.isEmpty ) {
            loadedVMObjects.splice( j, 1 );
        }
    }
    //Clear view model and update it.
    dataProvider.update( loadedVMObjects,  loadedVMObjects.length );
};

/**
 * This method is used to get the LOV values for 'propertyGroup' LOVs
 * @param {Object} response - the response of the performSearchViewModel SOA
 * @param {string} propertyName - The Property name used for creating LOV object
 */
export let processPropertyGroup = function( response, propertyName, vmo ) {
    var lovObjects = [];
    var selectedAccessors = appCtxSvc.getCtx( 'ATTRIBUTE_ACCESSORS' );

    if( response.ServiceData.plain ) {
        var modelObjects = cdm.getObjects( response.ServiceData.plain );
        // Create the list model object that will be displayed
        lovObjects = listBoxService.createListModelObjects( modelObjects, 'props.' + propertyName );
        for( var j = 0; j < lovObjects.length; j++ ) {
            lovObjects[ j ].propInternalValue = modelObjects[ j ].uid;
        }
    }
    var propertyGroupToBefiltered = [];
    // Do not list the property group which is already added with the same accessorType and accesor in the attribute acl table.
    //If Row - Propertygroup1:Group with security:Internal is already added, & if for a new row, Group with security:Internal is already selected then "Propertygroup1" is not allowed.
    //"Propertygroup1" will be filtered out and will not be displayed in the PropertyGroup list.
    Object.keys( selectedAccessors ).forEach( function( key ) {
        if( selectedAccessors[key].propertyGroup && selectedAccessors[key].accessorType === vmo.props.AccessorType.dbValue && selectedAccessors[key].accessor === vmo.props.Accessor.dbValue ) {
            propertyGroupToBefiltered.push( selectedAccessors[key].propertyGroup );
        }
    } );

    var propertyGroupFiltered = lovObjects.filter( function( obj ) {
        return !propertyGroupToBefiltered.includes( obj.propInternalValue  );
    } );
    // totalFound is assigned on condition based.
    // This is for usecase in which if we search for particular string eg "TablePropGroup1" and
    // if it returns records which are less than the property groups which are already selected in the attribute acl table i.e. propertyGroupToBefiltered
    // then totalFound should be propertyGroupFiltered otherwise it will set negative totalFound.
    return {
        lovEntries: propertyGroupFiltered,
        totalFound: propertyGroupToBefiltered.length >  response.totalFound ? propertyGroupFiltered.length : response.totalFound - propertyGroupToBefiltered.length
    };
};

/**
 * This function is called on lov change of READ/WRITE privilege in attribute ACE table
 * This function calls the resetReadWriteLovValue function in case of invalid combination: Read - Deny, Write - Allow
 * @param {*} eventData
 * @param {*} attributeAccessControlProvider
 */
export let updateReadWritePrivilege = function( eventData, attributeAccessControlProvider ) {
    var infoMsg;
    var prevDisplayValue = eventData.lovValue.viewModelProp.prevDisplayValues ? eventData.lovValue.viewModelProp.prevDisplayValues[0] : '';

    var aclEntries = attributeAccessControlProvider.viewModelCollection.loadedVMObjects;
    var index = aclEntries.findIndex( data => data.uid === eventData.selectedRow.uid );

    if( index >= 0 ) {
        if( eventData.lovValue.viewModelProp.propertyName === 'READ' ) {
            var writeDbValue = aclEntries[ index ].props.WRITE.dbValue;
            //Invalid combination where WRITE is allow and READ is set to deny
            if( eventData.lovValue.viewModelProp.dbValue === deny && writeDbValue === allow ) {
                resetReadWriteLovValue( aclEntries[ index ].props.READ, prevDisplayValue );
                infoMsg = _localTextBundle.AM0ReadInfoMessage;
                messagingService.showError( infoMsg );
            }
        } else if ( eventData.lovValue.viewModelProp.propertyName === 'WRITE' ) {
            var readDbValue = aclEntries[ index ].props.READ.dbValue;
            //Invalid combination where READ is deny and Write is set to allow
            if( eventData.lovValue.viewModelProp.dbValue === allow && readDbValue === deny ) {
                resetReadWriteLovValue( aclEntries[ index ].props.WRITE, prevDisplayValue );
                infoMsg = _localTextBundle.AM0WriteInfoMessage;
                messagingService.showError( infoMsg );
            }
        }
        attributeAccessControlProvider.update( aclEntries );
    }
};

/**
 * This function is called in case of invalid combination: Read - Deny, Write - Allow in attribute ACE table
 * Updating dataprovider to set the values and invoke icon renderer for table columns
 * @param {*} lovName - Read/Write
 * @param {*} prevDisplayValue - previous display value of the changed Lov
 */
export let resetReadWriteLovValue = function( lovName, prevDisplayValue ) {
    var prevIconName = '';
    // get the previous display icon of the changed column
    if( prevDisplayValue === allow ) {
        prevIconName = 'indicatorApprovedPass16';
    } else if ( prevDisplayValue === deny ) {
        prevIconName = 'indicatorNo16';
    }
    let lovEntry = {
        iconName: prevIconName,
        propInternalValue: prevDisplayValue,
        propDisplayValue: prevDisplayValue
    };
    uwPropertyService.updateLov( lovName, lovEntry );
    uwPropertyService.setValue( lovName, prevDisplayValue );
    uwPropertyService.setDisplayValue( lovName, [ prevDisplayValue ] );
    //set dirty to false since we are resetting the value to previous value to avoid the updateAMRuleAndACL2 SOA call
    uwPropertyService.setDirty( lovName, false );
};

/**
 * Handle selection on selection mode command
 * Update showCheckBox on cancelEdit and save actions with false value and
 * When clicked on selection mode command to enable, update showCheckBox with true value otherwise false value
 *
 * @param {} commandContext - commandContext
 * @param {} multiSelectEnabled - multiSelectEnabled from dataProvider SelectionModel
 */
export const handleSelectionMode = ( commandContext, multiSelectEnabled ) => {
    if ( commandContext.showCheckBox && commandContext.showCheckBox.update ) {
        //
        commandContext.showCheckBox.update( multiSelectEnabled );
    }
    if ( commandContext.attrAccessShowCheckBox && commandContext.attrAccessShowCheckBox.update ) {
        commandContext.attrAccessShowCheckBox.update( multiSelectEnabled );
    }
};

/**
  * Method to return startIndex for loading the data in rows of Attribute ACL Table
  * @param {*} startIndex - get the startIndex
  */
export let totalAttrAclStartIndex = function( startIndex ) {
    if( startIndex > 0 ) {
        startIndex += 1;
    }
    return startIndex;
};

const exports = {
    updateCtxAccessors,
    filterValidAccessorType,
    filterValidAccessor,
    filterValidPropertyGroup,
    loadAclProp,
    storeAceEntriesFromTable,
    validateAclRows,
    preSaveAction,
    getModifiedACLEntries,
    resetPrivileges,
    setAclEditable,
    getFilterString,
    loadObjectACLNames,
    addACEEntryToTable,
    removeACEEntryFromTable,
    clearAccessorCell,
    updatePrivileges,
    getAccessorTypeInfoName,
    getAccessorInfoName,
    loadObjectACLEntries,
    getViewModelColumns,
    initColumns,
    setCreateAclType,
    saveACL,
    updateSelectedAccessorType,
    updateSelectedAccessors,
    removeBlankRows,
    loadAttributeACLEntries,
    processPropertyGroup,
    handleSelectionMode,
    updateReadWritePrivilege,
    updateSelectedPropertyGroup,
    prepareUpdatesSoaInput,
    createUpdateAclEntry,
    createRestrictedProtectionEntry,
    onCheckBoxChange,
    unsetWriteRestricted,
    totalAttrAclStartIndex
};

export default exports;
