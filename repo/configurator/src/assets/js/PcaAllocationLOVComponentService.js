// Copyright (c) 2022 Siemens

/**
 * @module js/PcaAllocationLOVComponentService
 */

import AwLovEdit from 'viewmodel/AwLovEditViewModel';
import AwWidgetVal from 'viewmodel/AwWidgetValViewModel';
import pca0Constants from 'js/Pca0Constants';
import _ from 'lodash';

let exports = {};

/**
 * This method provides parent object uid of selected object.
 * @param {Object} props contains properties of VMO when user clicks on LOV in reuse mode
 * @return {String} - parent object uid
 */
let _getParent = ( props ) => {
    // In feature allocation, we keep the unsaved allocated family's uid on parentServerUID
    let parentUid = props.vmo.parentServerUID ? props.vmo.parentServerUID : props.vmo.parentUID;
    // There were some changes in 'performSearchViewModel' SOA's code and they were using 'BOREG_uid_to_tag' for all parent objects.
    // Since unassigned group is not persisted on the database, sending it as empty solves the issue.
    if( parentUid === pca0Constants.CFG_OBJECT_TYPES.TYPE_FAMILY_GRP_REVISION ) {
        parentUid = '';
    }
    return parentUid;
};

/**
 * This method provides Business Object type name of selected object.
 * @param {Object} props contains properties of VMO when user clicks on LOV in reuse mode
 * @return {String} Business Object type name
 */
let _getBOName = ( props ) => {
    return props.vmo.type;
};

/**
 * Method for getting allocation LOV filtering data which need to be passed to performSearchViewModel SOA
 * @param {Object} selectedProps - selected properties
 * @param {String} searchColumnName - column name
 * @return {Array} - filterData Which is used to filter results of performSearchViewModel SOA
 */
let _getAllocationFilterData = ( selectedProps, searchColumnName ) => {
    //checking selectedProps
    var filterString = [];
    // If the filterString is valid of selectedProps, then keep it as it is, else set it as empty.
    filterString[0] = selectedProps[searchColumnName].filterString ? selectedProps[searchColumnName].filterString : '';

    // Return filterData which holds information about column to be filtered along with filter string value.
    return[ {
        columnName: searchColumnName,
        values: filterString,
        operation: 'contains'
    } ];
};

/**
 * render function for AwLovEdit
 * @param {*} props contains properties of VMO when user clicks on LOV in reuse mode
 * @returns {JSX.Element} react component
 */
export const awPcaAllocationLOVComponentRenderFunction = ( props ) => {
    const { fields, viewModel, ...prop } = props;
    let fielddata = { ...prop.fielddata };
    //there is no way to fork a default/custom renderer before, so we'll need to differentiate usages here
    if( !fielddata.hasLov ) {
        // we need to reset the rendering hint in order to use this way!
        fielddata.renderingHint = '';

        const passedProps = { ...prop, fielddata };
        return (
            <AwWidgetVal {...passedProps} ></AwWidgetVal>
        );
    }
    fielddata.isSelectOnly = false;
    fielddata.dataProvider = viewModel.dataProviders.pca0AllocationDataProvider;
    fielddata.emptyLOVEntry = false;
    // Extract search column Name i.e object_name/cfg0ObjectId from props into data, So it can be reused further.
    viewModel.data.searchColumnName = props.name;
    const passedProps = { ...prop, fielddata };

    return (
        <AwLovEdit {...passedProps} ></AwLovEdit>
    );
};

/**
 * This method is used to process the response
 * @param {Object} response response to be processed
 * @param {String} searchColumnName - column name
 * @return {Object} all the nameTypes
 */
export let processSoaResponseForBONames = function( response, searchColumnName ) {
    var searchResults = {};
    if( response.searchResultsJSON ) {
        searchResults = JSON.parse( response.searchResultsJSON );
    }
    return searchResults.objects ? searchResults.objects.map( function( vmo ) {
        let mo = response.ServiceData.modelObjects[ vmo.uid ];

        //todo add namespace value to description?
        return {
            propDisplayValue : mo.props[searchColumnName].dbValues[ 0 ],
            propInternalValue : mo.props[searchColumnName].uiValues[ 0 ],
            mo: mo
        };
    } ) : [];
};


/**
 * Method for getting the search string for performSearchViewModel SOA
 * @param {Object} response to get last uid from searchResult
 * @param {Object} selectedProps - selected properties
 * @return {String} - filterString to filter results of performSearchViewModel SOA
 */
export let getFilterString = ( response, selectedProps ) => {
    //checking selectedProps
    var filterString = '';
    if( _.get( selectedProps, 'object_name.filterString' ) ) {
        filterString = selectedProps.object_name.filterString;
    } else if( _.get( selectedProps, 'cfg0ObjectId.filterString' ) ) {
        filterString = selectedProps.cfg0ObjectId.filterString;
    }
    return filterString;
};
/**
 * Get last object from JSON
 * @param {Object} response to get last uid from searchResult
 * @returns {String} returns uid as string from jsonstring
 */
export let getLastUid = ( response ) => {
    if( !_.isUndefined( response.ServiceData.plain ) ) {
        const length = response.ServiceData.plain.length;
        return response.ServiceData.plain[ length - 1 ];
    }
    return '';
};

/**
 * Method for getting the search input  for performSearchViewModel SOA.
 * @param {Object} selectedProps - selected properties
 * @param {String} searchColumnName - column name
 * @param {Object} startIndex - startIndex properties
 * @param {Object} configPerspective - configurator perspective
 * @param {Object} props contains properties of VMO when user clicks on LOV in reuse mode
 * @param {String} uidOfLastObject - Uid of last object
 * @param {String} prevSearchString - contains previous search string
 * @return {Object} returns search Input
 */
export let getSearchInputForAllocation = ( selectedProps, searchColumnName, startIndex, configPerspective, props, uidOfLastObject, prevSearchString ) => {
    // Get column filter data.
    const columnFilterData = _getAllocationFilterData( selectedProps, searchColumnName );
    // Get filter search string.
    const filterString = exports.getFilterString( null, selectedProps );
    // Get parent object uid of selected object.
    const parentUidData = _getParent( props );
    // Get Business Object name of selected object.
    const boNamestring = _getBOName( props );
    // LCS-939292 - The server encountered an error is displayed  when adding  reuse Group and reuse family  in Context -> Feature tab
    // When a VM is slow and the user continuously searches for a string,
    // then we get the values of the startIndex and uidOfLastObject of the previous search string.
    // If the filterString is not equal to the previous search string, then reset the values of startIndex and uidOfLastObject.
    if( filterString !== prevSearchString && !_.isUndefined( prevSearchString ) ) {
        startIndex = 0;
        uidOfLastObject = '';
    }
    // Return search input which holds information about column to be filter along with filter string value and search criteria.
    return {
        columnFilters: columnFilterData,
        cursor: {
            startIndex: startIndex
        },
        attributesToInflate: [ 'object_name', 'cfg0ObjectId' ],
        searchCriteria: {
            searchString: filterString,
            configPerspective:configPerspective,
            parentUid : parentUidData,
            boName: boNamestring,
            uidOfLastObject: uidOfLastObject
        },
        searchFilterFieldSortType: 'Priority',
        maxToLoad: 50,
        maxToReturn: 50,
        providerName: 'Pca0AllocationsProvider'
    };
};

export default exports = {
    awPcaAllocationLOVComponentRenderFunction,
    processSoaResponseForBONames,
    getFilterString,
    getLastUid,
    getSearchInputForAllocation
};

