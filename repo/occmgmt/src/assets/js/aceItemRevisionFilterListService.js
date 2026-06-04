// Copyright (c) 2024 Siemens

/**
 * @module js/aceItemRevisionFilterListService
 */
import _ from 'lodash';
import appCtxService from 'js/appCtxService';
import parsingUtils from 'js/parsingUtils';
import viewModelObjectService from 'js/viewModelObjectService';

var exports = {};

/**
 *  Updates the addElement state with selected object's UID
 * @internal
 * @param {object}selectedObjectUid - users selected value from the drop down
 * @param {object} addElementState - to get the addElementState
 */
export let updateAddElementStateWithSelectedObjectInList = function( selectedObjectUid, addElementState ) {
    let newAddElementState = { ...addElementState.value };
    let sourceParentVMO = viewModelObjectService.createViewModelObject( selectedObjectUid );
    newAddElementState.sourceParent = sourceParentVMO;
    addElementState.update( newAddElementState );
};

/**
 * Creates the search ID for query
 * Unique Search ID: search_object_UID + logged_in_user_UID + current_time
 * @internal
 * @param  {String}queryUID - queryUID
 * @return {String} advanced search Id
 */
export let getSearchId = function( queryUID ) {
    let userCtx = appCtxService.getCtx( 'user' );
    let loggedInUserUid = userCtx.uid;
    let timeSinceEpoch = new Date().getTime();
    return queryUID + loggedInUserUid + timeSinceEpoch;
};


/**
 *  Below filter the response and return the unique list
 *  @internal
 *  @param  {Object} - response - search result of performSearchViewModel SOA
 *  @param  {Object} - vmc - viewModel collection of data provider
 *  @return {Object} unique list of search elements
 */
export let getUniqueObjectListResponse = function( response, vmc ) {
    let loadedElements = vmc.getLoadedViewModelObjects();
    if ( !_.isEmpty( response.ServiceData.modelObjects ) ) {
        let searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );
        if ( searchResults ) {
            let uniqueObjectSet = new Set();
            let uniqueObjectList = [];

            response.ServiceData.plain.forEach( uid => {
                let searchElement = response.ServiceData.modelObjects[uid];
                let underlyingObject = searchElement.props.awb0UnderlyingObject.dbValues[0];

                if ( !uniqueObjectSet.has( underlyingObject ) && !loadedElements.some( element => element.underlyingObject === underlyingObject ) ) {
                    let listElement = {
                        propDisplayValue: searchElement.props.object_string.dbValues[0],
                        dispValue: searchElement.props.object_string.dbValues[0],
                        propInternalValue: searchElement.uid,
                        underlyingObject: underlyingObject
                    };
                    uniqueObjectSet.add( underlyingObject );
                    uniqueObjectList.push( listElement );
                }
            } );
            return uniqueObjectList;
        }
    }
    return loadedElements;
};

/**
 * returns true if more results exists
 * @internal
 * @param  {String}queryUID - queryUID
 * @return {String} advanced search Id
 */
export let isMoreValuesExist = function( response ) {
    return !response.cursor.endReached;
};

/**
 * Function to get start index for the SOA call
 * @internal
 * @param  {Object}response - response
 * @param  {int}startIndex - start index
 * @return {int} start index for next SOA call
 */
export let getStartIndex = function( response, startIndex ) {
    return response.endIndex > 0 ? response.endIndex : startIndex;
};


/**
 * ItemRevision Filter List service
 */

export default exports = {
    isMoreValuesExist,
    getSearchId,
    getUniqueObjectListResponse,
    updateAddElementStateWithSelectedObjectInList,
    getStartIndex
};
