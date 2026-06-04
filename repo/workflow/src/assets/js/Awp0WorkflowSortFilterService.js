// Copyright (c) 2022 Siemens

/**
 * @module js/Awp0WorkflowSortFilterService
 */
import _ from 'lodash';

var exports = {};

/**
 * Get the input object property and return the internal or display value.
 *
 * @param {Object} modelObject Model object whose propeties need to be loaded
 * @param {String} propName Property name that need to be checked
 * @param {boolean} isDispValue Display value need to be get or internal value
 *
 * @returns {Array} Property internal value or display value
 */
var _getPropValue = function( modelObject, propName ) {
    var propValue = null;
    if( modelObject && modelObject.props && modelObject.props[ propName ] ) {
        var values = null;
        if( modelObject.props[ propName ].uiValue ) {
            propValue = modelObject.props[ propName ].uiValue;
        } else {
            values = modelObject.props[ propName ].uiValues;
        }
        if( values && values[ 0 ] ) {
            propValue = values[ 0 ];
        }
    }
    return propValue;
};

/**
 * Get the column filter value based on user entered value.
 *
 * @param {Object} columnFilter Column filter object
 *
 * @returns {String} Column filter values that need to be filter
 */
var _getColumnFilterValue = function( columnFilter ) {
    return columnFilter.values[ 0 ].toLowerCase();
};

/**
 * Using regual expression update the special characters and return the correct string.
 *
 * @param {String} string Filter string that need to be updated
 * @param {Char} char with string will be updated
 */
var _replaceRegExpChars = function( string, char ) {
    var charExp = new RegExp( char, 'g' );
    return string.replace( charExp, char );
};

/**
 * This generates a regular expression that can be used for
 * @param {String} string string that we will be generating the regex for
 * @returns {RegExp} the formatted regular expression
 */
var _generateRegenx = function( filterString ) {
    // add '\' before any characters special to reg expressions
    var chars = [ '\\\\', '\\(', '\\)', '\\+', '\\[', '\\]', '\\$', '\\^', '\\|', '\\?', '\\.', '\\{', '\\}', '\\!', '\\=', '\\<' ];
    for( var n = 0; n < chars.length; n++ ) {
        filterString = _replaceRegExpChars( filterString, chars[ n ] );
    }
    return filterString;
};

/**
 * This function mocks the server logic for filtering text data with the 'Contains' operation.
 *
 * @param {Object} columnFilter Filter to apply
 * @param {Array} vmoObjects The dataset to filter
 * @returns {Object} The vmoObject data that matches the filter
 */
var _processContainsFilter = function( columnFilter, vmoObjects ) {
    var filterString = _getColumnFilterValue( columnFilter );
    var regExpString = _generateRegenx( filterString );
    var finalRexString = '*' + regExpString + '*';
    var regExp = new RegExp( finalRexString.replace( /[*]/ig, '.*' ), 'ig' );
    return vmoObjects.filter( function( vmoObject ) {
        // This is needed to reset the lastIndex after first match is done as it regex stored the last index value
        // and before the match beign we should reset it to default value 0.
        regExp.lastIndex = 0;
        var propValue = _getPropValue( vmoObject, columnFilter.columnName );
        if( regExp.test( propValue ) ) {
            return true;
        }
    } );
};

/**
 * This function mocks the server logic for filtering text data with the 'Does not contain' operation.
 *
 * @param {Object} columnFilter Filter to apply
 * @param {Array} vmoObjects The dataset to filter
 * @returns {Object} The vmoObject data that matches the filter
 */
var _processNotContainsFilter = function( columnFilter, vmoObjects ) {
    var filterString = _getColumnFilterValue( columnFilter );
    var regExpString = _generateRegenx( filterString );
    var finalRexString = '*' + regExpString + '*';
    var regExp = new RegExp( finalRexString.replace( /[*]/ig, '.*' ), 'ig' );
    return vmoObjects.filter( function( vmoObject ) {
        // This is needed to reset the lastIndex after first match is done as it regex stored the last index value
        // and before the match beign we should reset it to default value 0.
        regExp.lastIndex = 0;
        var propValue = _getPropValue( vmoObject, columnFilter.columnName );
        if( !regExp.test( propValue ) ) {
            return true;
        }
    } );
};

/**
 * This function mocks the server logic for filtering text data with the 'Begins with' operation.
 *
 * @param {Object} columnFilter Filter to apply
 * @param {Array} vmoObjects The dataset to filter
 * @returns {Object} The vmoObject data that matches the filter
 */
var _processStartsWithFilter = function( columnFilter, vmoObjects ) {
    var filterString = _getColumnFilterValue( columnFilter );
    var regExpString = _generateRegenx( filterString );
    var finalExpString = '^' + regExpString;
    var regExp = new RegExp( finalExpString.replace( /[*]/ig, '.*' ), 'ig' );
    return vmoObjects.filter( function( vmoObject ) {
        // This is needed to reset the lastIndex after first match is done as it regex stored the last index value
        // and before the match beign we should reset it to default value 0.
        regExp.lastIndex = 0;
        var propValue = _getPropValue( vmoObject, columnFilter.columnName );
        if( regExp.test( propValue ) ) {
            return true;
        }
    } );
};

/**
 * This function mocks the server logic for filtering text data with the 'Ends with' operation.
 *
 * @param {Object} columnFilter Filter to apply
 * @param {Array} vmoObjects The dataset to filter
 * @returns {Object} The vmoObject data that matches the filter
 */
var _processEndsWithFilter = function( columnFilter, vmoObjects ) {
    var filterString = _getColumnFilterValue( columnFilter );
    var regExpString = _generateRegenx( filterString );
    regExpString += '$';
    // Handling the * case here as above code doesnot handle it correctly
    var regExp = new RegExp( regExpString.replace( /[*]/ig, '.*' ), 'ig' );
    return vmoObjects.filter( function( vmoObject ) {
        // This is needed to reset the lastIndex after first match is done as it regex stored the last index value
        // and before the match beign we should reset it to default value 0.
        regExp.lastIndex = 0;
        var propValue = _getPropValue( vmoObject, columnFilter.columnName );
        if( regExp.test( propValue ) ) {
            return true;
        }
    } );
};

/**
 * This function mocks the server logic for filtering text data with the 'Equals' operation.
 *
 * @param {Object} columnFilter Filter to apply
 * @param {Array} vmoObjects The dataset to filter
 * @returns {Object} The vmoObject data that matches the filter
 */
var _processEqualsTextFilter = function( columnFilter, vmoObjects ) {
    var filterString = _getColumnFilterValue( columnFilter );
    var regExpString = _generateRegenx( filterString );
    var finalRexString = regExpString + '$';
    var regExp = new RegExp( finalRexString.replace( /[*]/ig, '.*' ), 'ig' );
    return vmoObjects.filter( function( vmoObject ) {
        // This is needed to reset the lastIndex after first match is done as it regex stored the last index value
        // and before the match beign we should reset it to default value 0.
        regExp.lastIndex = 0;
        var propValue = _getPropValue( vmoObject, columnFilter.columnName );
        if( regExp.test( propValue ) ) {
            return true;
        }
    } );
};

/**
 * Mocks server logic for filtering Text data with 'Does not equal' operation.
 *
 * @param {Object} columnFilter Filter to apply
 * @param {Array} vmoObjects The dataset to filter
 * @returns {Object} The vmoObject data that matches the filter
 */
var _processNotEqualsTextFilter = function( columnFilter, vmoObjects ) {
    var filterString = _getColumnFilterValue( columnFilter );
    var regExpString = _generateRegenx( filterString );
    var finalRexString = regExpString + '$';
    var regExp = new RegExp( finalRexString.replace( /[*]/ig, '.*' ), 'ig' );
    return vmoObjects.filter( function( vmoObject ) {
        // This is needed to reset the lastIndex after first match is done as it regex stored the last index value
        // and before the match beign we should reset it to default value 0.
        regExp.lastIndex = 0;
        var propValue = _getPropValue( vmoObject, columnFilter.columnName );
        if( !regExp.test( propValue ) ) {
            return true;
        }
    } );
};

/**
 * This function mocks the server logic for filtering text data with the 'Equals' operation.
 *
 * @param {Object} columnFilter Filter to apply
 * @param {Array} vmoObjects The dataset to filter
 * @returns {Object} The vmoObject data that matches the filter
 */
var _processCaseSensitiveEqualsTextFilter = function( columnFilter, vmoObjects ) {
    return vmoObjects.filter( function( vmoObject ) {
        for( var i = 0; i < columnFilter.values.length; i++ ) {
            if( !vmoObject.props[ columnFilter.columnName ].isArray ) {
                if( vmoObject.props[ columnFilter.columnName ].uiValue && columnFilter.values[ i ] ) {
                    return vmoObject.props[ columnFilter.columnName ].uiValue.toString().includes( columnFilter.values[ i ] );
                } else if( columnFilter.values[ i ] === '' && ( !vmoObject.props[ columnFilter.columnName ].value || vmoObject.props[ columnFilter.columnName ].value === null ) ) {
                    return true;
                }
            } else {
                if( vmoObject.props[ columnFilter.columnName ].uiValues && columnFilter.values[ i ] ) {
                    return vmoObject.props[ columnFilter.columnName ].uiValues.toString().includes( columnFilter.values[ i ] );
                }
            }
        }
        return false;
    } );
};

/**
 * Mocks server logic for filtering Text facets with 'caseSensitiveNotEquals' operation.
 *
 * @param {Object} columnFilter Filter to apply
 * @param {Array} vmoObjects The dataset to filter
 * @returns {Object} The vmoObject data that matches the filter
 */
var _processCaseSensitiveNotEqualsFilter = function( columnFilter, vmoObjects ) {
    return vmoObjects.filter( function( vmoObject ) {
        for( var i = 0; i < columnFilter.values.length; i++ ) {
            if( !vmoObject.props[ columnFilter.columnName ].isArray ) {
                if( columnFilter.values[ i ] === '' && ( !vmoObject.props[ columnFilter.columnName ].value || vmoObject.props[ columnFilter.columnName ].value === null ) ) {
                    return false;
                } else if( vmoObject.props[ columnFilter.columnName ].uiValue && columnFilter.values[ i ] ) {
                    return !vmoObject.props[ columnFilter.columnName ].uiValue.includes( columnFilter.values[ i ] );
                }
            } else {
                if( vmoObject.props[ columnFilter.columnName ].uiValues && columnFilter.values[ i ] ) {
                    let matchFound = false;
                    _.forEach( vmoObject.props[ columnFilter.columnName ].uiValues, function( uiValue ) {
                        if( uiValue !== columnFilter.values[ i ] ) {
                            matchFound = true;
                        }
                    } );
                    return matchFound;
                }
            }
        }
        return true;
    } );
};

/**
 * Filter the VMO objects based on column filter and retrun the filtered rows only.
 *
 * @param {Object} columnFilter Column filter  that need to apply on table
 * @param {Array} vmoObjects VMO objects that need to be sorted.
 *
 * @returns {Array} Filtered VMO objects that satis
 */
var _processTextFilterData = function( columnFilter, vmoObjects ) {
    if( !columnFilter || !vmoObjects || _.isEmpty( vmoObjects ) ) {
        return vmoObjects;
    }
    switch ( columnFilter.operation ) {
        case 'contains':
            vmoObjects = _processContainsFilter( columnFilter, vmoObjects );
            break;
        case 'notContains':
            vmoObjects = _processNotContainsFilter( columnFilter, vmoObjects );
            break;
        case 'startsWith':
            vmoObjects = _processStartsWithFilter( columnFilter, vmoObjects );
            break;
        case 'endsWith':
            vmoObjects = _processEndsWithFilter( columnFilter, vmoObjects );
            break;
        case 'equals':
            vmoObjects = _processEqualsTextFilter( columnFilter, vmoObjects );
            break;
        case 'notEquals':
            vmoObjects = _processNotEqualsTextFilter( columnFilter, vmoObjects );
            break;
        case 'caseSensitiveEquals':
            vmoObjects = _processCaseSensitiveEqualsTextFilter( columnFilter, vmoObjects );
            break;
        case 'caseSensitiveNotEquals':
            vmoObjects = _processCaseSensitiveNotEqualsFilter( columnFilter, vmoObjects );
            break;
        default:
            break;
    }
    return vmoObjects;
};

/**
 * Filter the table data based on input column filters and returns it.
 *
 * @param {Array} columnFilters Column filters array that need to apply on table
 * @param {Array} vmoObjects VMO objects that need to be sorted.
 *
 * @returns {Array} Filtered unique View model objects
 */
export let filterTableData = function( columnFilters, vmoObjects ) {
    if( !columnFilters || !columnFilters[ 0 ] || !vmoObjects || _.isEmpty( vmoObjects ) ) {
        return vmoObjects;
    }
    var modelObjects = vmoObjects;
    _.forEach( columnFilters, function( columnFilter ) {
        modelObjects = _processTextFilterData( columnFilter, modelObjects );
    } );

    modelObjects = _.uniqWith( modelObjects, function( objA, objB ) {
        return objA.uid === objB.uid;
    } );

    return modelObjects;
};

/**
 * Sort the input VMO objects based on input criteria.
 *
 * @param {Array} sortCriteria Table sort criteria array
 * @param {Array} vmoObjects VMO objects that need to be sorted.
 *
 * @returns {Array} Sorted View model objects
 */
export let applyTableSort = function( sortCriteria, vmoObjects ) {
    if( !sortCriteria || !sortCriteria[ 0 ] || !vmoObjects || _.isEmpty( vmoObjects ) ) {
        return vmoObjects;
    }
    var sortingCriteria = sortCriteria[0];
    var sortDirection = sortingCriteria.sortDirection;
    var sortColName = sortingCriteria.fieldName;

    if ( sortColName && sortDirection === 'ASC' ) {
        vmoObjects.sort( function( vmo1, vmo2 ) {
            if ( vmo1.props[ sortColName ].uiValues[ 0 ] <= vmo2.props[ sortColName ].uiValues[ 0 ] ) {
                return -1;
            }
            return 1;
        } );
    } else if( sortColName && sortDirection === 'DESC' ) {
        vmoObjects.sort( function( vmo1, vmo2 ) {
            if ( vmo1.props[ sortColName ].uiValues[ 0 ] >= vmo2.props[ sortColName ].uiValues[ 0 ] ) {
                return -1;
            }
            return 1;
        } );
    }
    return vmoObjects;
};

/**
 * Get the filter values that are being displayed in table for specific column and
 * return those values in set.
 *
 * @param {String} columnName Column name for values need to be fetched
 * @param {Array} vmoObjects VMO objects for column value need to be populated
 * @param {Object} data Data view model object
 */
export let getFilterFacetValues = function( columnName, vmoObjects, data ) {
    var values = new Set();
    _.forEach( vmoObjects, function( vmoObject ) {
        if( vmoObject && vmoObject.props && vmoObject.props[ columnName ]
            && vmoObject.props[ columnName ].displayValues ) {
            _.forEach( vmoObject.props[ columnName ].displayValues, function( dispValue ) {
                values.add( dispValue );
            } );
        } else {
            values.add( '' );
        }
    } );
    return {
        values: Array.from( values ),
        totalFound: Array.from( values ).length
    };
};

export default exports = {
    filterTableData,
    applyTableSort,
    getFilterFacetValues
};
