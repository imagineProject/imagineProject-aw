// Copyright (c) 2025 Siemens

/**
 * @module js/columnFilterService
 */

import _, { isEqual } from 'lodash';
import aceGetService from 'js/aceGetService';
import aceTreeLoadResultBuilderService from 'js/aceTreeLoadResultBuilderService';
import appContextService from 'js/appCtxService';

let exports = {};

const COLUMN_NAME = 'columnName';
const CRITERIA_TYPE_COLUMN = 'Column';
const CRITERIA_OPERATOR_TYPE_FILTER = 'Filter';
const CRITERIA_OPERATOR_TYPE_CLEAR = 'Clear';
const COLUMN_FILTER_CHANGE_GESTURE = [ 'COLUMN_FILTER_CHANGE' ];
const INITIAL_DATA_PROVIDER_ACTION = 'initializeAction';

let columnFilterParameterExtPoint = null;
let postGetOccFilterExtPoint = null;

var _filterRecipeCache = [];


/**
 * Initializes the column filter service by registering the necessary handlers.
 *
 */
export let initialize = function() {
    // Register the pre-get occurrence column filter extension handler.
    registerPreGetOccColumnFilterExtPoints();

    // Register the post-get occurrence column filter extension points
    registerPostGetOccColumnFilterExtPoints();
};


/**
 * Destroys the column filter service by clearing the filter recipe cache.
 *
 */
export let destroy = function() {
    _filterRecipeCache = [];

    if( columnFilterParameterExtPoint ) {
        aceGetService.unregisterGetOccInputProvider( columnFilterParameterExtPoint );
        columnFilterParameterExtPoint = null;
    }
    if( postGetOccFilterExtPoint ) {
        aceTreeLoadResultBuilderService.unregisterOccContextAtomicDataProvider( postGetOccFilterExtPoint );
        postGetOccFilterExtPoint = null;
    }
};

/**
 * Creates a filter criteria object based on the provided column filter criteria.
 *
 * @param {Array} newColumnFilterCriteria - An array of new column filter criteria.
 * @returns {Object} The filter criteria object.
 * @private
 */
const _createFilterCriteria = ( newColumnFilterCriteria ) => {
    //initialize the filter criteria object
    const filterCriteria = {
        criteriaOperatorType: '',
        criteriaType: CRITERIA_TYPE_COLUMN,
        subCriteria: [],
        criteriaValues: [],
        criteriaDisplayValue: ''
    };
    // If there are new column filter criteria, set the criteria operator type to filter.
    if ( newColumnFilterCriteria.length > 0 ) {
        filterCriteria.criteriaOperatorType = CRITERIA_OPERATOR_TYPE_FILTER;
        newColumnFilterCriteria.forEach( criteria => {
            filterCriteria.criteriaValues.push( JSON.stringify( criteria ) );
        } );
    } else {
        // If there are no new column filter criteria, set the criteria operator type to clear.
        filterCriteria.criteriaOperatorType = CRITERIA_OPERATOR_TYPE_CLEAR;
    }

    return filterCriteria;
};

/**
 * Checks if the user has performed a column filter operation.
 *
 * @param {Object} loadInput - The input object containing grid and column provider instance.
 * @param {Object} soaInput - The SOA input object to be updated with user gesture.
 * @returns {boolean} True if the user has performed a column filter operation, false otherwise.
 * @private
 */
const _hasUserPerformedColumnFilterOperation = ( loadInput, soaInput ) => {
    let isOperationPerformed = false;
    // Check if loadInput or soaInput is provided
    if( loadInput || soaInput.inputData ) {
        // Check if the dataProviderActionType is initialize data provider action and userGesture is empty or undefined
        if( loadInput.dataProviderActionType === INITIAL_DATA_PROVIDER_ACTION &&
            ( soaInput.inputData.requestPref.userGesture === undefined || soaInput.inputData.requestPref.userGesture.length === 0 ) ) {
            isOperationPerformed = true;
        }
    }
    return isOperationPerformed;
};

/**
 * Populates column filters based on the provided input and context.
 *
 * @param {Object} loadInput - The input object containing grid and column provider instance.
 * @param {Object} currentContext - The current context object containing recipe information.
 * @param {Object} soaInput - The SOA input object to be updated with user gesture.
 * @param {Object} occContext - The OCC context object containing view key.
 * @private
 */
const _populateColumnFilters = ( loadInput, currentContext, soaInput, occContext ) => {
    if( loadInput?.grid?.columnProviderInstance && loadInput.grid.gridOptions?.isFilteringEnabled ) {
        //get the column applied column filter criteria
        const newColumnFilterCriteria = JSON.parse( JSON.stringify( loadInput.grid.columnProviderInstance.columnFilters ) );

        // Check if the column filter recipe exists and if the user has performed a column filter operation.
        const hasRecipe = _filterRecipeCache && _filterRecipeCache.length > 0;
        const hasColumnFilterRecipe = hasRecipe && COLUMN_NAME in _filterRecipeCache[0];
        const hasNewColumnFilterCriteria = newColumnFilterCriteria.length > 0;

        // Check if the column filter criteria has changed compared to the cached column filter recipe.
        const hasColumnFilterChanged = newColumnFilterCriteria.length !== _filterRecipeCache.length || !_.isEqual( newColumnFilterCriteria, _filterRecipeCache );

        // If the column filter recipe exists or new column filter criteria exist and the user has performed a column filter operation, update the filter object.
        if( ( hasColumnFilterRecipe || hasNewColumnFilterCriteria ) && _hasUserPerformedColumnFilterOperation( loadInput, soaInput ) ) {
        // Create and add the column filter criteria to the filter object.
            const filterCriteria = _createFilterCriteria( newColumnFilterCriteria );
            soaInput.inputData.filter.recipe = [ filterCriteria ];

            if( hasColumnFilterChanged ) {
                // Set the user gesture to COLUMN_FILTER_CHANGE_GESTURE to indicate that the column filters have changed.
                soaInput.inputData.requestPref.userGesture = COLUMN_FILTER_CHANGE_GESTURE;

                // Update the recipe in the occContext with the new column filter criteria.
                _filterRecipeCache = filterCriteria.criteriaOperatorType !== CRITERIA_OPERATOR_TYPE_CLEAR ? newColumnFilterCriteria : [];
            }
        }
    }
};

/**
 * Registers the pre-get occurrence column filter extension points.
 *
 * This function defines and registers an extension point for column filters
 * in the occurrence management system. It includes a condition to check if
 * the 4GD feature is supported and a function to populate column filters.
 * @private
 */
const registerPreGetOccColumnFilterExtPoints = function() {
    // Define the condition function for the column filter parameter extension point.
    let columnFilterParameterCondition = function() {
        return true;
    };

    // Define the function to populate column filters.
    let columnFilterParameterFunction = function( loadInput, occContext, currentContext, soaInput ) {
        _populateColumnFilters( loadInput, currentContext, soaInput, occContext );
    };

    // Define the column filter parameter extension point object.
    columnFilterParameterExtPoint = {
        key: 'columnFilterPreGetOccHandler', // Unique identifier for the extension point.
        condition: columnFilterParameterCondition, // Condition function to check if the extension point should be applied.
        populateGetOccInput: columnFilterParameterFunction // Function to populate column filters.
    };

    // Register the column filter parameter extension point with the aceGetService.
    aceGetService.registerGetOccInputProvider( columnFilterParameterExtPoint );
};

/**
 * Converts the json string array input to array of column filter objects.
 *
 * @param {Object} columnFilters - The input column filters in json string format.
 * @returns {Object} - Array of column filter objects.
 * @private
 */

const _getColumnFilterObjects = ( columnFilters ) => {
    const resultMap = {};

    for( const columnFilter of columnFilters ) {
        const obj = JSON.parse( columnFilter );
        const { columnName, values, operation } = obj;

        if( !resultMap[columnName] ) {
            resultMap[columnName] = { columnName, values: [ ...values ], operation };
        } else {
            // Merge values and remove duplicates
            const mergedValues = new Set( [ ...resultMap[columnName].values, ...values ] );
            resultMap[columnName].values = Array.from( mergedValues );
        }
    }

    return Object.values( resultMap );
};

/**
 * Performs post-processing for column filter changes.
 *
 * @param {Object} response - The response object from the service.
 * @param {Object} finalOccContextValue - The final occurrence context value.
 * @param {Object} inputOccContext - The input occurrence context.
 * @param {Object} treeLoadOutput - The tree load output.
 * @param {Object} treeLoadInput - The tree load input.
 * @private
 */
let performPostProcessingForColumnFilterChange = function( response, finalOccContextValue, inputOccContext, treeLoadOutput, treeLoadInput ) {
    if( !_.isUndefined( response.ServiceData.partialErrors ) && response.ServiceData.partialErrors.length > 0 ) {
        if( inputOccContext.recipe && inputOccContext.recipe.length > 0 && 'columnName' in inputOccContext.recipe[0] ) {
            // update the recipe with the column filter recipe
            _filterRecipeCache = [];
        }
    }

    // This is used to update the column filters in the UI if the response contains a filter recipe.
    if( response?.filter?.recipe?.length > 0 ) {
        let columnFilters = [];
        if( response.filter.recipe[0].criteriaValues?.length > 0 ) {
            columnFilters = _getColumnFilterObjects( response.filter.recipe[0].criteriaValues );
        }
        treeLoadInput.grid.columnProviderInstance.setColumnFilters( columnFilters );
        _filterRecipeCache = columnFilters;
    }
};

/**
 * Registers the post getOccurrences filter handler for column filter changes.
 *
 * This function sets up a condition to check if the user gesture indicates a column filter change,
 * and if so, it performs post-processing for the column filter change.
 *
 * The function registers an extension point with a unique key, a condition function to check for
 * the column filter change gesture, and a function to handle the post-processing.
 *
 * @private
 */
let registerPostGetOccColumnFilterExtPoints = function() {
    // Post getOccurrences filter handler registration
    let postGetOccColumnFilterCondition = function( soaInput, treeLoadInput, treeLoadOutput  ) {
        // Check if the user gesture indicates a column filter change
        return  soaInput?.inputData?.requestPref?.userGesture === COLUMN_FILTER_CHANGE_GESTURE ||
            treeLoadOutput?.filter?.recipe?.length > 0;
    };

    // Define the function to perform post-processing for column filter changes
    let postGetOccColumnFilterFunc = function( response, finalOccContextValue, inputOccContext, treeLoadOutput, treeLoadInput ) {
        performPostProcessingForColumnFilterChange( response, finalOccContextValue, inputOccContext, treeLoadOutput, treeLoadInput );
    };

    // Define the post getOccurrences filter extension point object
    postGetOccFilterExtPoint = {
        key : 'columnFilterPostGetOccHandler', // Unique identifier for the extension point
        condition: postGetOccColumnFilterCondition, // Condition function to check if the extension point should be applied
        addOccContextAtomicDataForUpdate: postGetOccColumnFilterFunc // Function to handle post-processing
    };

    // Register the post getOccurrences filter extension point with the aceTreeLoadResultBuilderService
    aceTreeLoadResultBuilderService.registerOccContextAtomicDataProvider( postGetOccFilterExtPoint );
};

export default exports = {
    initialize,
    destroy
};
