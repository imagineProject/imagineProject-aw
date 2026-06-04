// Copyright (c) 2024 Siemens

/**
 * @module js/asm1EbomUtils
 */
import _ from 'lodash';

/**
  * Get search Input for performSearch soa
  *
  * @param {Array} prefValues - preference values ex. FND0_PART_TYPES pref values
  * @returns {Object} - search Input for performSearch soa
  */
export const getSearchInput = ( prefValues ) => {
    if( prefValues ) {
        let jointListOfIncludeObjectTypes = prefValues.join( ',' );

        return {
            attributesToInflate: [ 'parent_types', 'type_name' ],
            internalPropertyName: '',
            maxToLoad: 50,
            maxToReturn: 50,
            providerName: 'Awp0TypeSearchProvider',
            searchCriteria: {
                defaultType:'',
                listOfIncludeObjectTypes: jointListOfIncludeObjectTypes,
                loadSubTypes: 'true',
                searchString:'',
                typeSelectorId: ''
            },
            searchFilterFieldSortType: 'Alphabetical',
            searchFilterMap: {},
            searchSortCriteria: []
        };
    }
};

/**
  * Get Array of displayable types
  *
  * @param {Array} searchResultsInp - performSearch soa response searchResults
  * @param {Array} prefValues - preference values ex. FND0_PART_TYPES pref values
  * @returns {Array} - Array of displayable types
  */
export const getDisplayableTypes = function( searchResultsInp, prefValues ) {
    let displayableTypes = [];
    if( searchResultsInp && searchResultsInp.length > 0 ) {
        let typeHierarchy = [];
        _.forEach( searchResultsInp, ( obj ) => {
            if ( obj ) {
                let typeName = obj.props.type_name.dbValue ? obj.props.type_name.dbValue : obj.props.type_name.dbValues[ 0 ];
                typeHierarchy.push( typeName );
            }
        }
        );
        // Displayable types that we will get from performSearch soa response will be in random order
        // we will have iterate over preference values and see which type is displayable by checking that type
        // value in typeHierarchy array which contains all the displayable types for input
        // listOfIncludeObjectTypes: joinedString
        if( typeHierarchy.length > 0 ) {
            _.forEach( prefValues, ( prefVal ) => {
                if( typeHierarchy.includes( prefVal ) ) {
                    displayableTypes.push( prefVal );
                }
            } );
        }
    }

    return displayableTypes;
};

const exports = {
    getSearchInput,
    getDisplayableTypes
};

export default exports;

