// Copyright (c) 2024 Siemens
/**
 * This file contains functionality for PCA related advanced search service.
 *
 * @module js/pca0AdvancedSearchService
 */

import advancedSearchService from 'js/advancedSearchService';
import advancedSearchUtils from 'js/advancedSearchUtils';
import viewModelObjectService from 'js/viewModelObjectService';

import _ from 'lodash';

/*
 *   Export APIs section starts
 */
let exports = {};

/**
 * createAdvancedSearchViewModelObject
 * @function createAdvancedSearchViewModelObject
 * @param {Object} advancedSearchState - object containing the advanced search state
 * @return {Object} viewModelObj
 */
export const createAdvancedSearchViewModelObject = ( advancedSearchState ) => {
    let searchState = advancedSearchState.getValue();
    let viewModelObj = viewModelObjectService.createViewModelObject( searchState.savedQuery.value, 'SpecialEdit' );
    if( searchState && searchState.savedQuery && searchState.savedQuery.value ) {
        //get passed-in saved query
        _.set( viewModelObj.props, 'awp0AdvancedQueryName.dbValue', searchState.savedQuery.value );
        _.set( viewModelObj.props, 'awp0AdvancedQueryName.uiValue', searchState.savedQuery.uiValue );
        _.set( viewModelObj.props, 'awp0AdvancedQueryName.uiValues[0]', searchState.savedQuery.uiValue );
    }
    return viewModelObj;
};

/**
 * saveSearchCriteriaAttributes - The attributes of the saved query are saved in the search state so
 * that they can be used in SOA call to get the results.
 * @function saveSearchCriteriaAttributes
 * @param {Object} savedQueryObject - the saved query object
 * @param {Object} awp0AdvancedQueryAttributes - the advanced query attributes
 * @param {Object} searchState - the search state
 * @param {boolean} considerRevRuleForSearch - the flag to consider rev rule for search
 */
export const saveSearchCriteriaAttributes = ( savedQueryObject, awp0AdvancedQueryAttributes, searchState, considerRevRuleForSearch ) => {
    let queryUID = savedQueryObject.dbValue;
    let criteria = {
        queryUID
    };

    //Key is propName
    //Value is Array of [propName, displayName, dbValue, uiValue]
    let searchCriteriaUiValueMap = advancedSearchUtils.setAdvancedSearchCriteriaMap( awp0AdvancedQueryAttributes, criteria );

    let searchCriteriaUIVal = '';
    let savedQueryAttributes = {};
    for( const [ key, value ] of Object.entries( searchCriteriaUiValueMap ) ) {
        searchCriteriaUIVal += value[ 1 ] + '=' + ( value[ 3 ] ? value[ 3 ] : value[ 2 ] ) + '; ';
        savedQueryAttributes[ value[ 0 ] ] = value[ 3 ] ? value[ 3 ] : value[ 2 ];
    }
    const newSearchState = { ...searchState.value };
    newSearchState.advancedSearchCriteria = criteria;
    //Need to splice the space and semi colon from the last entry for the breadcrumb
    newSearchState.referencingSavedQuery = searchCriteriaUIVal.slice( 0, -2 );
    newSearchState.searchCriteriaMap = searchCriteriaUiValueMap;
    const savedQuery = {
        name: savedQueryObject.uiValues[ 0 ],
        value: savedQueryObject.dbValue
    };

    newSearchState.savedQuery = savedQuery;
    newSearchState.savedQueryAttributes = savedQueryAttributes;
    newSearchState.considerRevRuleForSearch = considerRevRuleForSearch;
    searchState.update( newSearchState );
};

/**
 * updateOrClearSearchAttributes
 * @function updateOrClearSearchAttributes
 * @param {Object}searchUid - the search uid
 * @param {string}modelObject - the model object
 * @param {Object}searchState - the search state
 * @return {Object} AdvancedQueryAttributes
 */
export const updateOrClearSearchAttributes = ( searchUid, modelObject, searchState ) => {
    let newSearchState = { ...searchState.getValue() };
    // CLean old saved query attributes and other meta data.
    delete newSearchState.searchCriteriaMap;
    delete newSearchState.savedQueryAttributes;
    delete newSearchState.advancedSearchCriteria;

    let attributesViewModelObj = advancedSearchService.processAttributesViewModelObj( advancedSearchService.createAttributesViewModelObject( searchUid, modelObject ) );

    return advancedSearchUtils.populateQueryAttributesForSavedSearch( attributesViewModelObj, newSearchState.savedQueryAttributes );
};

export default exports = {
    createAdvancedSearchViewModelObject,
    saveSearchCriteriaAttributes,
    updateOrClearSearchAttributes
};
