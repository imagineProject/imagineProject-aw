import appCtxService from 'js/appCtxService';
import _ from 'lodash';
import dmSvc from 'soa/dataManagementService';
import cdm from 'soa/kernel/clientDataModel';
import localeService from 'js/localeService';
import iconService from 'js/iconService';
import viewModelObjectService from 'js/viewModelObjectService';
var removeButtonName = 'remove';
var addButtonName = 'add';

export let updateSharedWith = function( shareReportState ) {
    var nwshareReportState = shareReportState.getValue();
    var Fnd0Applicable_Assignment = nwshareReportState.selectedReport.props.Fnd0Applicable_Assignment;
    if( Fnd0Applicable_Assignment.dbValues.length > 0 ) {
        if( Fnd0Applicable_Assignment.dbValues.length === 1 && appCtxService.ctx.userSession.props.user.dbValue === Fnd0Applicable_Assignment.dbValues[0] ) {
            return 'private';
        }
        return 'custom';
    }
    return 'public';
};

export let onChangeOfSharedWith = function( sharedWith, shareReportState, dataProvider ) {
    var nwShareReportState = shareReportState.getValue();
    var nwSharedWithList = [];
    if( sharedWith === 'public' ) {
        // sharedWith === everyone (organization)
        var localTextBundle = localeService.getLoadedText( 'OrganizationMessages' );
        var organizationNode = {
            uid: 'SiteLevel',
            displayValue: localTextBundle.Organization,
            name: localTextBundle.Organization,
            type: 'Site',
            location: 'Site',
            props: {
                object_string: { uiValues: [ localTextBundle.Organization ], dbValues: [ localTextBundle.Organization ] }
            }
        };
        organizationNode = viewModelObjectService.constructViewModelObjectFromModelObject( organizationNode, 'EDIT', null, organizationNode, true );
        var iconURL = iconService.getTypeIconURL( 'ProjectTeam' );
        organizationNode.typeIconURL = iconURL;
        organizationNode.hasThumbnail = false;
        nwSharedWithList.push( organizationNode );
    } else if( sharedWith === 'custom' ) {
        // sharedWith === selected user (custom)
        _.forEach( nwShareReportState.selectedReport.props.Fnd0Applicable_Assignment.dbValues, ( value )=> {
            value !== appCtxService.ctx.user.uid && nwSharedWithList.push( { uid:value } );
        } );
    }
    nwShareReportState.sharedWithList = nwSharedWithList;
    //TODO: Clearing selections on state but UI shows selected
    nwShareReportState.selectedAccessors = [];
    shareReportState.update( nwShareReportState );
    getSharedWithList( shareReportState, '', dataProvider, sharedWith );
};
export let searchWithinSharedTable = function( modelObjects, searchString ) {
    var results = [];
    if( searchString && searchString.length > 0 ) {
        searchString = searchString.toLowerCase();
    }
    _.forEach( modelObjects, function( accessor ) {
        if( accessor && accessor.props && accessor.props.object_string && accessor.props.object_string.uiValues && accessor.props.object_string.uiValues.length > 0 ) {
            var obj_string = accessor.props.object_string.uiValues[ 0 ];
            obj_string = obj_string.toLowerCase();
            if( obj_string.indexOf( searchString ) !== -1 ) {
                results.push( accessor );
            }
        } else {
            results.push( accessor );
        }
    } );
    return results;
};
export let getSharedWithList = async function( shareReportState, searchString, dataProvider, sharedWith ) {
    var nwShareReportState = shareReportState.getValue();
    var selectedAccessor;
    var modelObjects = [];
    var isPrivate = sharedWith === 'private' || sharedWith === 'public';
    nwShareReportState.selectedAccessors ? _.forEach( nwShareReportState.selectedAccessors, ( accessor )=>{
        if( accessor?.object ) {
            selectedAccessor = accessor.object;
        } else {
            selectedAccessor = accessor;
        }
        var uid = selectedAccessor?.uid;
        var removeItemIndex = -1;
        uid && _.forEach( nwShareReportState.sharedWithList, ( object, index )=> {
            if( object.uid === uid ) {
                removeItemIndex = index;
            }
        } );
        if( !isPrivate && nwShareReportState.add === false && removeItemIndex > -1 ) {
        // Removing organization/project from sharedWithList
            nwShareReportState.sharedWithList.splice( removeItemIndex, 1 );
        } else if( !isPrivate && nwShareReportState.add === true && removeItemIndex === -1 ) {
        // Adding organization/project to sharedWithList
            selectedAccessor && nwShareReportState.sharedWithList.push( selectedAccessor );
        }
    } ) : '';
    _.forEach( nwShareReportState.sharedWithList, ( object )=> {
        nwShareReportState.selectedReport.props.owning_user.dbValues[0] !== object.uid &&
        modelObjects.push( object );
    } );
    var arrayUids = [];
    modelObjects.forEach( ( object )=> arrayUids.push( object.uid ) );
    var propList = [ 'awp0CellProperties', 'group', 'object_string', 'role', 'user' ];
    await dmSvc.getProperties( arrayUids, propList ).then( function() {
        // Create view model objects
        modelObjects = modelObjects.map( function( vmo ) {
            vmo = cdm.getObject( vmo.uid ) ? cdm.getObject( vmo.uid ) : vmo;
            return vmo;
        } );
    } );
    modelObjects = searchWithinSharedTable( modelObjects, searchString );
    modelObjects.sort( ( data1, data2 ) => { return data1.props.object_string.uiValues[0].localeCompare( data2.props.object_string.uiValues[0] ); } );

    if( arrayUids.length === 1 && arrayUids[0] === 'SiteLevel' ) {
        arrayUids.pop();
    } else {
        arrayUids.push( appCtxService.ctx.userSession.props.user.dbValue );
    }
    if( arrayUids.length === nwShareReportState.selectedReport?.props?.Fnd0Applicable_Assignment?.dbValues.length &&
        arrayUids.every( ( uid ) =>nwShareReportState.selectedReport.props.Fnd0Applicable_Assignment.dbValues.findIndex(  user=> user === uid ) >= 0 ) ) {
        nwShareReportState.changedSharedWith = false;
    }else{
        sharedWith === 'custom' && arrayUids.length === 1 ? nwShareReportState.changedSharedWith = false : nwShareReportState.changedSharedWith = true;
    }
    shareReportState.update( nwShareReportState );
    dataProvider.update( modelObjects, modelObjects.length );
    return modelObjects;
};

const removeSelectedAccessorsFromAccessorsString = ( selectedAccessorsToRemove, currentAccessorsString ) => {
    let currentAccessorsUids = currentAccessorsString.split( ',' );
    let updatedAccessorsUids = new Set();
    for( let index = 0; index < currentAccessorsUids.length; index++ ) {
        let eachCurrentAccessorUid = currentAccessorsUids[ index ];
        for( let selectedAccessorsIndex = 0; selectedAccessorsIndex < selectedAccessorsToRemove.length; selectedAccessorsIndex++ ) {
            let eachSelectedAccessorUid = selectedAccessorsToRemove[ selectedAccessorsIndex ].uid;
            if( eachCurrentAccessorUid !== eachSelectedAccessorUid ) {
                updatedAccessorsUids.add( eachCurrentAccessorUid );
            }
        }
    }
    let updatedAccessorsUidsAsArray = Array.from( updatedAccessorsUids );
    return getSharedWithListString( updatedAccessorsUidsAsArray );
};

const getSharedWithListString = ( currentSharedWithList ) => {
    let currentSharedWithListAsString = '';

    for ( let index = 0; index < currentSharedWithList.length; index++ ) {
        let accessor = currentSharedWithList[index];
        let eachSelectedObject = null;

        // Check if accessor and accessor.object are not null or undefined
        if ( accessor?.object?.uid ) {
            eachSelectedObject = accessor.object;
        } else {
            eachSelectedObject = accessor;
        }

        // Check if eachSelectedObject is valid before trying to access its properties
        if ( eachSelectedObject?.uid ) {
            // Add to string
            if ( index === 0 ) {
                currentSharedWithListAsString += eachSelectedObject.uid;
            } else {
                currentSharedWithListAsString += ',' + eachSelectedObject.uid;
            }
        }
    }

    return currentSharedWithListAsString;
};

export let addShareReport = function( shareReportState ) {
    const nwShareReportState = shareReportState.getValue();
    nwShareReportState.disableAddButton = true;
    nwShareReportState.disableRemoveButton = true;
    if( nwShareReportState.selectedAccessors && nwShareReportState.selectedAccessors.length > 0 ) {
        let accessorsString = getSharedWithListString( nwShareReportState.selectedAccessors );
        if( accessorsString.length > 0 ) {
            nwShareReportState.accessorsString = accessorsString;
        }
    }
    nwShareReportState.add = true;
    shareReportState.update( nwShareReportState );
};
export let removeShareReport = function( shareReportState ) {
    const nwShareReportState = shareReportState.getValue();
    nwShareReportState.disableAddButton = true;
    nwShareReportState.disableRemoveButton = true;
    if( nwShareReportState.selectedAccessors && nwShareReportState.selectedAccessors.length > 0 ) {
        nwShareReportState.accessorsString = removeSelectedAccessorsFromAccessorsString( nwShareReportState.selectedAccessors, nwShareReportState.currentAccessorsString );
    }
    nwShareReportState.add = false;
    shareReportState.update( nwShareReportState );
};
export let prepareInputForDeleteRelations = function( shareReportStateOrCtx, access ) {
    var primaryObject = shareReportStateOrCtx.selectedReport ? shareReportStateOrCtx.selectedReport : shareReportStateOrCtx.selected;
    var sharedWithList = shareReportStateOrCtx.sharedWithList ? shareReportStateOrCtx.sharedWithList : '';
    var inputData = [];
    var secondaryObjects = [];
    if( access === 'public' || access === 'private' ) {
        // iterate all primaryObject.props.Fnd0_assignments(secondaryObjects) and prepare input
        _.forEach( primaryObject.props.Fnd0Applicable_Assignment.dbValues, ( value )=> {
            secondaryObjects.push( { uid:value } );
        } );
    } else {
        // remove primaryObject.props.Fnd0_assignments and sharedwithList commons
        // sharedWithList contains removed accessors then prepare that list and make input
        // make array of common between sharedList nd Fnd0_assi..
        // make array of removed -> fnd0_ass.. contains but sharedList does not containing
        // both array(secondaryObjects) needs to prepare return into inputData
        _.forEach( sharedWithList, ( value )=> {
            if( primaryObject.props.Fnd0Applicable_Assignment.dbValues.indexOf( value.uid ) !== -1 ) {
                secondaryObjects.push( value );
            }
        } );
        _.forEach( primaryObject.props.Fnd0Applicable_Assignment.dbValues, ( value )=> {
            var flag = false;
            _.forEach( sharedWithList, ( sharedWithValues )=> {
                if( value === sharedWithValues.uid ) {
                    flag = true;
                }
            } );
            if( !flag ) {
                secondaryObjects.push( { uid:value } );
            }
        } );
    }
    _.forEach( secondaryObjects, ( secondaryObject ) => {
        inputData.push( {
            primaryObject: {
                type: primaryObject.type,
                uid: primaryObject.uid
            },
            secondaryObject: {
                type: secondaryObject.type,
                uid: secondaryObject.uid
            },
            relationType: 'Fnd0Applicable_Assignment',
            clientId: '',
            userData: {
                uid: 'AAAAAAAAAAAAAA',
                type: 'unknownType'
            }
        } );
    } );
    return inputData;
};
export let prepareInputForCreateRelations = ( shareReportState ) => {
    // primaryObject => selectedReport (shareReportState.selectedReport)
    // secondaryObjects => sharedWithList (shareReportState.sharedWithList)

    // Adding owning_user of reportDef into secondaryObjects as it should be always available to owner
    var primaryObject = shareReportState.selectedReport;
    var secondaryObjects = shareReportState.sharedWithList;
    var containsOwnerInSelectedAccessor = secondaryObjects.findIndex( reportDefn => reportDefn.uid === primaryObject.props.owning_user.dbValue );
    if( containsOwnerInSelectedAccessor === -1 ) {
        secondaryObjects.push( { uid:primaryObject.props.owning_user.dbValues[0], type:'User' } );
    }
    var inputData = [];
    _.forEach( secondaryObjects, ( secondaryObject ) => {
        inputData.push( {
            primaryObject: {
                type: primaryObject.type,
                uid: primaryObject.uid
            },
            secondaryObject: {
                type: secondaryObject.type,
                uid: secondaryObject.uid
            },
            relationType: 'Fnd0Applicable_Assignment',
            clientId: '',
            userData: {
                uid: 'AAAAAAAAAAAAAA',
                type: 'unknownType'
            }
        } );
    } );
    return inputData;
};
export let processReportTemplate = ( response, shareReportState )=> {
    var nwShareReportState = shareReportState.getValue();
    var reportId = response.ServiceData.updated[0];
    var reportDefn = response.ServiceData.modelObjects[reportId];
    nwShareReportState.selectedReport = reportDefn;
    shareReportState.update( nwShareReportState );
};

export let updateSelectedReportForPublic = ( response, shareReportState )=>{
    var nwShareReportState = shareReportState.getValue();
    var reportDefn = response.modelObjects[nwShareReportState.selectedReport.uid];
    nwShareReportState.selectedReport = reportDefn;
    shareReportState.update( nwShareReportState );
    return reportDefn;
};
let changeButtonVisibilty = function( uniqueUsers, buttonName, selectedAccessors, currentSearchFolderAccessors, nwShareReportState ) {
    if( uniqueUsers > 0 ) {
        nwShareReportState.selectedAccessors = selectedAccessors;
        if( buttonName === removeButtonName ) {
            nwShareReportState.availableTableSelection = true;
            nwShareReportState.sharedWithTableSelection = false;
            nwShareReportState.disableRemoveButton = true;
            nwShareReportState.disableAddButton = false;
        } else if( buttonName === addButtonName ) {
            nwShareReportState.sharedWithTableSelection = true;
            nwShareReportState.availableTableSelection = false;
            nwShareReportState.disableAddButton = true;
            nwShareReportState.disableRemoveButton = false;
            nwShareReportState.currentAccessorsString = getSharedWithListString( currentSearchFolderAccessors );
        }
    }else{
        delete nwShareReportState.selectedAccessors;
        nwShareReportState.availableTableSelection = false;
        nwShareReportState.sharedWithTableSelection = false;
        nwShareReportState.disableRemoveButton = true;
        nwShareReportState.disableAddButton = true;
    }
};
export let disableAddButtonForAvailable = function( buttonName, dataProvider, currentSearchFolderAccessors, shareReportState ) {
    let selectedAccessors = dataProvider.selectedObjects;
    const nwShareReportState = shareReportState.getValue();
    var sharedWithList = nwShareReportState.sharedWithList;
    let cnt = 0;
    selectedAccessors && _.forEach( selectedAccessors, ( value )=> {
        if( value.uid !== appCtxService.ctx.user.uid && sharedWithList.findIndex( user => user.uid === value.uid ) === -1 ) {
            cnt += 1;
        }
    } );
    changeButtonVisibilty( cnt, buttonName, selectedAccessors, currentSearchFolderAccessors, nwShareReportState );
    shareReportState.update( nwShareReportState );
};
export let disableButtonForSharedWith = function( buttonName, dataProvider, currentSearchFolderAccessors, shareReportState ) {
    let selectedAccessors = dataProvider.selectedObjects;
    const nwShareReportState = shareReportState.getValue();
    changeButtonVisibilty( selectedAccessors.length, buttonName, selectedAccessors, currentSearchFolderAccessors, nwShareReportState );
    shareReportState.update( nwShareReportState );
};

const getSearchFolderAccessorsString = ( currentSearchFolderAccessors ) => {
    let currentSearchFolderAccessorsAsString = '';
    for( let index = 0; index < currentSearchFolderAccessors.length; index++ ) {
        let eachSelectedObject = currentSearchFolderAccessors[ index ];
        if( index === 0 ) {
            currentSearchFolderAccessorsAsString += eachSelectedObject.uid;
        } else {
            currentSearchFolderAccessorsAsString += ',' + eachSelectedObject.uid;
        }
    }
    return currentSearchFolderAccessorsAsString;
};

export let disableButton = function( buttonName, dataProvider, currentSearchFolderAccessors, shareReportState ) {
    let selectedAccessors = dataProvider.selectedObjects;
    const newSearchFolderShareRuleState = { ...shareReportState.value };
    if( selectedAccessors && selectedAccessors.length > 0 ) {
        newSearchFolderShareRuleState.selectedAccessors = selectedAccessors;
        if( buttonName === removeButtonName ) {
            newSearchFolderShareRuleState.availableTableSelection = true;
            newSearchFolderShareRuleState.sharedWithTableSelection = false;
            newSearchFolderShareRuleState.disableRemoveButton = true;
            newSearchFolderShareRuleState.disableAddButton = false;
        } else if( buttonName === addButtonName ) {
            newSearchFolderShareRuleState.sharedWithTableSelection = true;
            newSearchFolderShareRuleState.availableTableSelection = false;
            newSearchFolderShareRuleState.disableAddButton = true;
            newSearchFolderShareRuleState.disableRemoveButton = false;
            newSearchFolderShareRuleState.currentAccessorsString = getSearchFolderAccessorsString( currentSearchFolderAccessors );
        }
    } else if( selectedAccessors && selectedAccessors.length === 0 && newSearchFolderShareRuleState.currentAccessorsString && newSearchFolderShareRuleState.currentAccessorsString.length === 0 ) {
        delete newSearchFolderShareRuleState.selectedAccessors;
        newSearchFolderShareRuleState.availableTableSelection = false;
        newSearchFolderShareRuleState.sharedWithTableSelection = false;
        newSearchFolderShareRuleState.disableRemoveButton = true;
        newSearchFolderShareRuleState.disableAddButton = true;
    }
    shareReportState.update( newSearchFolderShareRuleState );
};

export let disableButton2 = ( buttonName, selectionData, shareReportState ) => {
    let selectedAccessors = selectionData.selected;
    let nonSiteSelectedAccessors = [];
    const newSearchFolderShareRuleState = { ...shareReportState.value };
    _.forEach( selectedAccessors, function( eachSelected ) {
        if( eachSelected && eachSelected.type !== 'Site' ) {
            nonSiteSelectedAccessors.push( eachSelected );
        }
    } );
    if( nonSiteSelectedAccessors && nonSiteSelectedAccessors.length > 0 ) {
        newSearchFolderShareRuleState.selectedAccessors = nonSiteSelectedAccessors;
        if( buttonName === removeButtonName ) {
            newSearchFolderShareRuleState.availableTableSelection = true;
            newSearchFolderShareRuleState.sharedWithTableSelection = false;
            newSearchFolderShareRuleState.disableRemoveButton = true;
            newSearchFolderShareRuleState.disableAddButton = false;
        } else if( buttonName === addButtonName ) {
            newSearchFolderShareRuleState.sharedWithTableSelection = true;
            newSearchFolderShareRuleState.availableTableSelection = false;
            newSearchFolderShareRuleState.disableAddButton = true;
            newSearchFolderShareRuleState.disableRemoveButton = false;
            newSearchFolderShareRuleState.currentAccessorsString = getSearchFolderAccessorsString( [] );
        }
        shareReportState.update( newSearchFolderShareRuleState );
    }
};

export const updateOrgTreeSelectionAfterShareReportStateUpdate = ( selectionData, shareReportState, selectionDataUpdater ) => {
    if( shareReportState.sharedWithTableSelection && shareReportState.disableAddButton ) {
        const newSelectionData = { ...selectionData };
        newSelectionData.selected = [];
        selectionDataUpdater.selectionData( newSelectionData );
    }
};

/**
 * To clear all the context related to Organization Tree
 */
export let unRegisterOrgInShareReportContext = function() {
    appCtxService.unRegisterCtx( 'orgTreeData' );
    appCtxService.unRegisterCtx( 'initialHierarchy' );
    appCtxService.unRegisterCtx( 'parents' );
    appCtxService.unRegisterCtx( 'currentLevel' );
    appCtxService.unRegisterCtx( 'expansionCounter' );
    appCtxService.unRegisterCtx( 'selectedTreeNode' );
    appCtxService.unRegisterCtx( 'treeLoadInput' );
};

const ShareTemplateService = {
    updateSharedWith,
    onChangeOfSharedWith,
    getSharedWithListString,
    getSharedWithList,
    removeSelectedAccessorsFromAccessorsString,
    addShareReport,
    removeShareReport,
    searchWithinSharedTable,
    prepareInputForDeleteRelations,
    prepareInputForCreateRelations,
    processReportTemplate,
    updateSelectedReportForPublic,
    disableButtonForSharedWith,
    disableAddButtonForAvailable,
    disableButton,
    disableButton2,
    updateOrgTreeSelectionAfterShareReportStateUpdate,
    unRegisterOrgInShareReportContext
};
export default ShareTemplateService;

