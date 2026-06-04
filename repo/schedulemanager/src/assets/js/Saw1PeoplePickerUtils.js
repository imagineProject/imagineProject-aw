// Copyright (c) 2022 Siemens

/**
 * @module js/Saw1PeoplePickerUtils
 */
import _ from 'lodash';
import viewModelObjectSvc from 'js/viewModelObjectService';


var exports = {};

/**
 * Method to add objects to dataProvider
 *
 * @param {Array} newObjects - Objects to add
 * @param {Object} dataProviderToUpdate - Data provider to update
 */
export let addSelectedUsers = function( newObjects, dataProviderToUpdate ) {
    if( newObjects && dataProviderToUpdate ) {
        let allResources = dataProviderToUpdate.viewModelCollection.loadedVMObjects;
        _.forEach( newObjects, function( vmo ) {
            vmo.selected = false;
            if( vmo.modelType.typeHierarchyArray.indexOf( 'ScheduleMember' ) > -1 ) {
                allResources.push( viewModelObjectSvc.createViewModelObject( _.get( vmo, 'props.resource_tag.dbValue' ) ) );
            } 
            else if( vmo.modelType.typeHierarchyArray.indexOf( 'GroupMember' ) > -1 ) {
                allResources.push( viewModelObjectSvc.createViewModelObject( _.get( vmo, 'props.user.dbValue' ) ) );
            } 
            else {
                allResources.push( vmo );
            }
        } );

        // Remove the duplicates if present in presetObjects list.
        allResources = _.uniqWith( allResources, function( objA, objB ) {
            return objA.uid === objB.uid;
        } );

        //Update data provider.
        dataProviderToUpdate.update( allResources );
    }
    return true;
};

/**
 * Method to remove objects From dataProvider
 *
 * @param {Array} removeObjects - Objects to remove
 * @param {Object} dataProviderToUpdate - Data provider to update
 */
export let removeSelectedUsers = function( removeObjects, dataProviderToUpdate ) {
    if( removeObjects && dataProviderToUpdate ) {
        // Get all loaded objects of data provider.
        const modelObjects = dataProviderToUpdate.viewModelCollection.loadedVMObjects;
        let validObjects = [];

        // Remove selected objects from loaded objects and update the provider.
        if( modelObjects && modelObjects.length > 0 && removeObjects && removeObjects.length > 0 ) {
            validObjects = _.difference( modelObjects, removeObjects );
            dataProviderToUpdate.update( validObjects, validObjects.length );
        }
    }
    return true;
};

exports = {
    addSelectedUsers,
    removeSelectedUsers
};
export default exports;
