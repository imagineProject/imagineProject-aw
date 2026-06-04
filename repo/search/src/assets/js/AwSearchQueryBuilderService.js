// Copyright 2024 Siemens Product Lifecycle Management Software Inc.

/**
 * Logic for Shape Search
 * @module js/AwSearchQueryBuilderService
 */

import searchCommonUtils from 'js/searchCommonUtils';
import soaService from 'soa/kernel/soaService';
import advancedSearchService from './advancedSearchService';
import AwSearchImportExportSavedQuery from 'js/AwSearchImportExportSavedQuery';
import uwPropertyService from 'js/uwPropertyService';
import eventBus from 'js/eventBus';
import _ from 'lodash';

export const processOutput = ( data, dataCtxNode, searchData ) => {
    const newSearchData = { ...searchData.value };
    newSearchData.totalFound = data.totalFound;
    newSearchData.totalLoaded = data.totalLoaded;
    newSearchData.endIndex = data.endIndex;
    newSearchData.startIndex = data.cursor.startIndex;
    newSearchData.cursorInfo = data.cursor;
    newSearchData.cursorInfo.totalFound = data.totalFound;
    newSearchData.cursorInfo.totalLoaded = data.totalLoaded;
    newSearchData.cursorInfoString = JSON.stringify( newSearchData.cursorInfo );
    searchData.update( newSearchData );
};


/**
   * Get the default page size used for max to load/return.
   *
   * @param {Array|Object} defaultPageSizePreference - default page size from server preferences
   * @returns {Number} The amount of objects to return from a server SOA response.
   */
export let getDefaultPageSize = function( defaultPageSizePreference ) {
    return searchCommonUtils.getDefaultPageSize( defaultPageSizePreference );
};

export let updateSelectedQueryTypeValue = function( searchState ) {
    return !searchState.selectedQueryType ? '' : searchState.selectedQueryType;
};

export let getQueryBuilderSearchFilterMap = function( selectedQueryType ) {
    if( !selectedQueryType || selectedQueryType === '' ) {
        return {};
    }
    return {
        'public.private': [
            {
                searchFilterType: 'StringFilter',
                stringDisplayValue: selectedQueryType,
                stringValue: selectedQueryType
            }
        ]
    };
};

export const convertQueriesToLovEntries = function( response ) {
    let modelObjectList = Object.values( response.ServiceData.modelObjects );

    return modelObjectList.map( function( query ) {
        return {
            propInternalValue: query.uid,
            propDisplayValue: query.props.object_string.uiValues[ 0 ],
            object: query
        };
    } );
};

/**
   * Check if the Highest Possible Parent Of Selected Type is ItemRevision.
   *
   * @param {Object} typeListProp - type view model object
   * @returns {Boolean} if the Highest Possible Parent Of Selected Type is ItemRevision
   */
export const isHighestPossibleParentOfSelectedTypeItemRevision = ( typeListProp ) => {
    let typeHierarchy = typeListProp.split( '::' );
    return typeHierarchy[ 2 ] === 'ItemRevision' || typeHierarchy[ 3 ] === 'ItemRevision';
};

/**
   * Sets the default values for search type and rev rule prop.
   *
   * @param {Object} typeListProp - type view model object
   * @param {Object} revisionRuleProp - rev rule view model object
   * @param {Object} queryInfo - query info object
   * @param {Object} typeDisplayName - type display name object
   * @returns {Object} The updated type object, revision rule object, and returns if the Highest Possible Parent Of Selected Type is ItemRevision.
   */
export const setDefaultValuesForSearchTypeAndRevRule = ( typeListProp, revisionRuleProp, queryInfo, typeDisplayName ) => {
    let newTypeListProp = _.cloneDeep( typeListProp );
    let newRevisionRule = _.cloneDeep( revisionRuleProp );
    newTypeListProp.dbValue = queryInfo.queryClass;
    newTypeListProp.uiValue = typeDisplayName && typeDisplayName.types && typeDisplayName.types[ 0 ] ? typeDisplayName.types[ 0 ].displayName : queryInfo.queryClass;
    newRevisionRule.dbValue = queryInfo.revRule;
    newRevisionRule.uiValue = queryInfo.revRule;
    let typeHierarchy = typeDisplayName && typeDisplayName.types && typeDisplayName.types[ 0 ] ? typeDisplayName.types[ 0 ].uid.split( '::' ) : [];
    let isHighestPossibleParentItemRevision = typeHierarchy && typeHierarchy.length > 0 && ( typeHierarchy[ 2 ] === 'ItemRevision' || typeHierarchy[ 3 ] === 'ItemRevision' );
    return {
        typeListProp: newTypeListProp,
        revisionRuleProp: newRevisionRule,
        isHighestPossibleParentItemRevision: isHighestPossibleParentItemRevision
    };
};

/**
   * construct the queryName, queryDesc, queryClass, and revRule from ImanQuery object.
   *
   * @param {Object} response - SOA response
   * @returns {Object} queryName, queryDesc, queryClass, and revRule info.
   */
export const getQueryInfo = ( response ) => {
    let modelObjects = response.modelObjects;
    let object;
    for( const [ key, value ] of Object.entries( modelObjects ) ) {
        if( value.type === 'ImanQuery' ) {
            object = value;
        }
    }
    let revRule = '';
    let queryName = object.props.query_name.dbValues[ 0 ];
    let queryDesc = object.props.query_desc.dbValues[ 0 ];
    let queryClass = object.props.query_class.dbValues[ 0 ];
    let queryClauses =  object.props.query_clauses.dbValues;
    let lengthOfQueryClauses = queryClauses.length;
    let lastValue = lengthOfQueryClauses > 0 ? queryClauses[ lengthOfQueryClauses - 1 ] : '';
    let revRuleExists = lengthOfQueryClauses > 0 ? lastValue.indexOf( 'REVRULE' ) !== -1 : false;
    if( revRuleExists ) {
        let revRuleArr = queryClauses[ lengthOfQueryClauses - 1 ].split( 'REVRULE' );
        revRule = revRuleArr[ 1 ].trim();
    }
    let querySorter = AwSearchImportExportSavedQuery.getQuerySorter( lastValue );
    return {
        queryName: queryName,
        queryDesc: queryDesc,
        queryClass: queryClass,
        revRule: revRule,
        querySorter: querySorter
    };
};

export let getQueryTypeName = function( typeListProp ) {
    let typeHierarchy = typeListProp.split( '::' );
    return typeHierarchy[ 1 ];
};

export let updatePropsEditability = function( isEditing ) {
    let startEditBool = isEditing === 'startEdit';
    return {
        isEditable: startEditBool
    };
};

export let updateSearchTypeInState = ( typeListProp, queryState ) => {
    let newQueryState = queryState.getValue();
    let searchType = getQueryTypeName( typeListProp.dbValue );
    newQueryState.currentSearchType = searchType;
    queryState.update( newQueryState );
};

export let resetSearchType = ( typeListProp, queryState, queryInfo ) => {
    let newQueryState = queryState.getValue();
    let newTypeListProp = _.cloneDeep( typeListProp );

    newTypeListProp.dbValue = queryInfo.queryClass;
    newTypeListProp.uiValue = queryInfo.queryClass;

    newQueryState.currentSearchType = queryState.initialSearchType;
    queryState.update( newQueryState );

    return {
        typeListProp: newTypeListProp
    };
};

export let updateRevisionRuleState = ( queryState, revisionRuleProp ) => {
    let newQueryState = queryState.getValue();
    newQueryState.currentRevisionRule = revisionRuleProp.uiValue;
    queryState.update( newQueryState );
};

export let initializeQueryState = ( queryState, queryStateUpdater, queryNameProp, queryDescProp, subPanelContext ) => {
    const newQueryState = { ...queryState };

    newQueryState.queryUid = subPanelContext.selected.uid;
    newQueryState.initialSearchType = subPanelContext.selected.props.query_class.dbValues[ 0 ];
    newQueryState.currentSearchType = subPanelContext.selected.props.query_class.dbValues[ 0 ];
    newQueryState.initialQueryName = subPanelContext.selected.props.query_name.dbValues[ 0 ];
    newQueryState.initialQueryNameDisplay = subPanelContext.selected.props.query_name.displayValues[0];
    newQueryState.initialQueryDesc = subPanelContext.selected.props.query_desc.dbValues[ 0 ];
    newQueryState.initialQueryDescDisplay = subPanelContext.selected.props.query_desc.displayValues[0];

    let queryClauses = subPanelContext.selected.props.query_clauses.dbValues;
    if( queryClauses.length > 0 ) {
        newQueryState.querySorter = AwSearchImportExportSavedQuery.getQuerySorter( queryClauses[ queryClauses.length - 1 ] );
    }

    let newQueryNameProp = _.cloneDeep( queryNameProp );
    let newQueryDescProp = _.cloneDeep( queryDescProp );

    newQueryNameProp.dbValue = newQueryState.initialQueryName;
    newQueryNameProp.uiValue = newQueryState.initialQueryNameDisplay;

    newQueryDescProp.dbValue = newQueryState.initialQueryDesc;
    newQueryDescProp.uiValue = newQueryState.initialQueryDescDisplay;

    if( subPanelContext.selected.uid === subPanelContext.context.searchState.saveAsUid ) {
        uwPropertyService.setIsEditable( newQueryNameProp, true );
        uwPropertyService.setIsEnabled( newQueryNameProp, true );

        uwPropertyService.setIsEditable( newQueryDescProp, true );
        uwPropertyService.setIsEnabled( newQueryDescProp, true );

        let newSearchState = { ...subPanelContext.context.searchState.getValue() };
        newSearchState.saveAsUid = '';
        subPanelContext.context.searchState.update( newSearchState );
    }

    queryStateUpdater.queryState( newQueryState );

    return {
        queryNameProp: newQueryNameProp,
        queryDescProp: newQueryDescProp
    };
};

export let updateQueryNameState = ( queryNameProp, queryState ) => {
    queryState.currentQueryName = queryNameProp.dbValue;
};

export let updateQueryDescState = ( queryDescProp, queryState ) => {
    queryState.currentQueryDesc = queryDescProp.dbValue;
};

export let saveQuery = async function( queryState, clauses, searchState ) {
    let inputData = {
        input: {
            queryName: queryState.currentQueryName,
            queryDescription: queryState.currentQueryDesc,
            searchType: queryState.currentSearchType,
            isICSType: false,
            queryClauses: clauses,
            queryUID: queryState.queryUid,
            revisionRuleName: queryState.currentRevisionRule ? queryState.currentRevisionRule : '',
            sorter: queryState.querySorter
        }
    };

    soaService.postUnchecked( 'Internal-Search-2024-12-SavedQuery', 'createOrModifySavedQuery', inputData )
        .then( function( response ) {
            let newSearchState = { ...searchState.getValue() };
            newSearchState.editing = '';
            searchState.update( newSearchState );

            eventBus.publish( 'cdm.relatedModified', {
                relatedModified: [ response.savedquery ],
                refreshLocationFlag: true
            } );
        } );
};

export let resetQueryNameAndDesc = ( queryState, queryNameProp, queryDescProp ) => {
    let newQueryNameProp = _.cloneDeep( queryNameProp );
    let newQueryDescProp = _.cloneDeep( queryDescProp );

    newQueryNameProp.dbValue = queryState.initialQueryName;
    newQueryNameProp.uiValue = queryState.initialQueryName;

    newQueryDescProp.dbValue = queryState.initialQueryDesc;
    newQueryDescProp.uiValue = queryState.initialQueryDesc;

    return {
        queryNameProp: newQueryNameProp,
        queryDescProp: newQueryDescProp
    };
};

export let resetEditingValue = ( subPanelContext ) => {
    let searchState = subPanelContext.context.searchState;
    let saveAsUid = searchState.saveAsUid;
    let selectedQueryUid = subPanelContext.selected.uid;

    let newSearchState = { ...searchState.getValue() };

    if( saveAsUid === selectedQueryUid ) {
        newSearchState.editing = 'startEdit';
    } else {
        newSearchState.editing = '';
    }

    searchState.update( newSearchState );
};

export let setIsEditableValueForLOVs = ( state, typeListProp, revisionRuleProp ) => {
    if( state === 'startEdit' ) {
        uwPropertyService.setIsEditable( typeListProp, true );
        uwPropertyService.setIsEditable( revisionRuleProp, true );

        uwPropertyService.setIsEnabled( typeListProp, true );
        uwPropertyService.setIsEnabled( revisionRuleProp, true );
    } else {
        uwPropertyService.setIsEditable( typeListProp, false );
        uwPropertyService.setIsEditable( revisionRuleProp, false );
    }
};

const AwSearchQueryBuilderService = {
    processOutput,
    getDefaultPageSize,
    updateSelectedQueryTypeValue,
    getQueryBuilderSearchFilterMap,
    convertQueriesToLovEntries,
    isHighestPossibleParentOfSelectedTypeItemRevision,
    getQueryInfo,
    setDefaultValuesForSearchTypeAndRevRule,
    getQueryTypeName,
    updatePropsEditability,
    updateSearchTypeInState,
    resetSearchType,
    updateRevisionRuleState,
    initializeQueryState,
    updateQueryNameState,
    updateQueryDescState,
    saveQuery,
    resetQueryNameAndDesc,
    resetEditingValue,
    setIsEditableValueForLOVs
};

export default AwSearchQueryBuilderService;
