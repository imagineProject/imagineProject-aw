// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Ac0FeedFilterService
 */
import advancedSearchService from 'js/advancedSearchService';
import lovService from 'js/lovService';
import advancedSearchUtils from 'js/advancedSearchUtils';
import clientDataModel from 'soa/kernel/clientDataModel';
import viewModelObjectService from 'js/viewModelObjectService';
import eventBus from 'js/eventBus';
import appCtxService from 'js/appCtxService';
import AwStateService from 'js/awStateService';
import messagingService from 'js/messagingService';
import AwPromiseService from 'js/awPromiseService';
import soaSvc from 'soa/kernel/soaService';
import _dateTimeSvc from 'js/dateTimeService';
import _ from 'lodash';

export let getFilterPropsFromSelectedQueryCriteria = function( response, queryUID ) {
    var ac0FeedFilterCtx = appCtxService.getCtx( 'ac0FeedFilter' );
    if( typeof ac0FeedFilterCtx !== 'undefined' && ac0FeedFilterCtx.ac0Filters3 ) {
        return ac0FeedFilterCtx.ac0Filters3;
    }

    var modelObject = clientDataModel.getObject( response.advancedQueryCriteria.uid );
    var modelObjectForDisplay = {
        uid: queryUID,
        props: advancedSearchService.getRealProperties( modelObject, ac0FeedFilterCtx, queryUID, '', false ), //needs to be refactored ... ba method doesn't seem to be processing ctxObj
        type: 'ImanQuery',
        modelType: modelObject.modelType
    };

    modelObjectForDisplay.props.ac0PrivateParticipants = {};

    var feedQueryViewModelObj = viewModelObjectService.constructViewModelObjectFromModelObject(
        modelObjectForDisplay, 'Search' );

    _.forEach( feedQueryViewModelObj.props, function( prop ) {
        if( prop.lovApi ) {
            lovService.initNativeCellLovApi( prop, null, 'Search',
                feedQueryViewModelObj );
            prop.hint = 'checkboxoptionlov';
            prop.suggestMode = true;
            prop.propertyRequiredText = '';
        }
        if( prop.type === 'BOOLEAN' ) {
            prop.propertyLabelDisplay = 'NO_PROPERTY_LABEL';
            prop.hint = 'triState';
            advancedSearchUtils.initTriState( prop );
        }
    } );

    return Object.assign( {}, feedQueryViewModelObj.props );
};

export let getFilterPropsFromSelectedQueryCriteriaAddUsers = function( response, queryUID2 ) {
    var ac0FeedFilterCtx = appCtxService.getCtx( 'ac0FeedFilter' );
    if( typeof ac0FeedFilterCtx !== 'undefined' && ac0FeedFilterCtx.ac0Filters2 ) {
        return ac0FeedFilterCtx.ac0Filters2;
    }

    var modelObject = clientDataModel.getObject( response.advancedQueryCriteria.uid );

    var modelObjectForDisplay = {
        uid: queryUID2,
        props: advancedSearchService.getRealProperties( modelObject, ac0FeedFilterCtx, queryUID2, '', false ),
        type: 'ImanQuery',
        modelType: modelObject.modelType
    };

    var feedQueryViewModelObj = viewModelObjectService.constructViewModelObjectFromModelObject(
        modelObjectForDisplay, 'Search' );

    _.forEach( feedQueryViewModelObj.props, function( prop ) {
        if( prop.lovApi ) {
            lovService.initNativeCellLovApi( prop, null, 'Search',
                feedQueryViewModelObj );
            prop.hint = 'checkboxoptionlov';
            prop.suggestMode = true;
            prop.propertyRequiredText = '';
            prop.propertyDisplayName = 'Participants';
        }
    } );

    return Object.assign( {}, feedQueryViewModelObj.props );
};

/**
 *
 * @param {*} awp0AdvancedQueryAttributes
 * @param {*} awp0AdvancedQueryAttributes2
 * @param {*} dateCreatedBefore
 * @param {*} dateCreatedAfter
 * @param {*} searchState
 */
export let doFeedFiltering = function( awp0AdvancedQueryAttributes, awp0AdvancedQueryAttributes2, dateCreatedBefore, dateCreatedAfter, searchState ) {
    const newSearchState = { ...searchState.value };
    var criteria = {
        typeOfSearch: 'DISCUSSION_FILTERING',
        utcOffset: String( -1 * new Date().getTimezoneOffset() ),
        lastEndIndex: '',
        totalObjectsFoundReportedToClient: ''
    };
    newSearchState.advancedSearchCriteria = criteria;

    var filterCriteriaUIValueMap = updateURLForFeedFilters( awp0AdvancedQueryAttributes, awp0AdvancedQueryAttributes2, dateCreatedBefore, dateCreatedAfter );

    var filterBreadcrumbDisplayValues = '';
    if( awp0AdvancedQueryAttributes.props.ac0IsPrivate.uiValue !== '' ) {
        if( filterBreadcrumbDisplayValues !== '' ) {
            filterBreadcrumbDisplayValues += '; ';
        }
        filterBreadcrumbDisplayValues += awp0AdvancedQueryAttributes.props.ac0IsPrivate.propertyDisplayName + '=' + awp0AdvancedQueryAttributes.props.ac0IsPrivate.uiValue;
    }
    if( awp0AdvancedQueryAttributes.props.ac0Priority.uiValue !== '' ) {
        if( filterBreadcrumbDisplayValues !== '' ) {
            filterBreadcrumbDisplayValues += '; ';
        }
        filterBreadcrumbDisplayValues += awp0AdvancedQueryAttributes.props.ac0Priority.propertyDisplayName + '=' + awp0AdvancedQueryAttributes.props.ac0Priority.uiValue;
    }
    if( awp0AdvancedQueryAttributes.props.ac0Status.uiValue !== '' ) {
        if( filterBreadcrumbDisplayValues !== '' ) {
            filterBreadcrumbDisplayValues += '; ';
        }
        filterBreadcrumbDisplayValues += awp0AdvancedQueryAttributes.props.ac0Status.propertyDisplayName + '=' + awp0AdvancedQueryAttributes.props.ac0Status.uiValue;
    }
    if( awp0AdvancedQueryAttributes2.props.ac0PrivateParticipants.uiValue !== '' ) {
        if( filterBreadcrumbDisplayValues !== '' ) {
            filterBreadcrumbDisplayValues += '; ';
        }
        filterBreadcrumbDisplayValues += awp0AdvancedQueryAttributes2.props.ac0PrivateParticipants.propertyDisplayName + '=' + awp0AdvancedQueryAttributes2.props.ac0PrivateParticipants.uiValue;
    }
    if( dateCreatedBefore.uiValue !== '' ) {
        if( filterBreadcrumbDisplayValues !== '' ) {
            filterBreadcrumbDisplayValues += '; ';
        }
        filterBreadcrumbDisplayValues += dateCreatedBefore.propertyDisplayName + '=' + dateCreatedBefore.uiValue;
    }
    if( dateCreatedAfter.uiValue !== '' ) {
        if( filterBreadcrumbDisplayValues !== '' ) {
            filterBreadcrumbDisplayValues += '; ';
        }
        filterBreadcrumbDisplayValues += dateCreatedAfter.propertyDisplayName + '=' + dateCreatedAfter.uiValue;
    }

    newSearchState.filterBreadcrumbDisplayValues = filterBreadcrumbDisplayValues;
    newSearchState.searchCriteriaMap = filterCriteriaUIValueMap;
    newSearchState.totalFound = undefined;

    searchState.update( newSearchState );

    eventBus.publish( 'primaryWorkarea.reset' );
};


/**
 * updateURLForAdvancedSearch
 * @function updateURLForAdvancedSearch
 * @param {Object} awp0AdvancedQueryAttributes
 * @param {Object} awp0AdvancedQueryAttributes2
 * @param {Object} dateCreatedBefore
 * @param {Object} dateCreatedAfter
 * @returns {Object} filterParametersMap
 */
export let updateURLForFeedFilters = function( awp0AdvancedQueryAttributes, awp0AdvancedQueryAttributes2, dateCreatedBefore, dateCreatedAfter ) {
    var savedQueryAttributes = awp0AdvancedQueryAttributes.props;
    var savedQueryAttributes2 = awp0AdvancedQueryAttributes2.props;
    var dateMap = {};
    dateMap.CommentCreatedBefore = dateCreatedBefore;
    dateMap.CommentCreatedAfter = dateCreatedAfter;

    var filterParametersMap = { query: 'feedFiltering' };
    filterParametersMap = advancedSearchUtils.populateSavedQueryParametersMap( savedQueryAttributes, filterParametersMap );
    filterParametersMap = advancedSearchUtils.populateSavedQueryParametersMap( savedQueryAttributes2, filterParametersMap );
    filterParametersMap = advancedSearchUtils.populateSavedQueryParametersMap( dateMap, filterParametersMap );

    // Need to make sure this is the correct format some languages/locals have a format that is not supported.
    if( filterParametersMap.dateCreatedAfter ) {
        filterParametersMap.dateCreatedAfter  = getEnglishDateTime( dateMap.CommentCreatedAfter.dateApi.dateObject );
    }
    if( filterParametersMap.dateCreatedBefore ) {
        filterParametersMap.dateCreatedBefore  = getEnglishDateTime( dateMap.CommentCreatedBefore.dateApi.dateObject );
    }

    updateAc0FeedFilterInContext( savedQueryAttributes, savedQueryAttributes2, dateMap );

    AwStateService.instance.go( '.', {
        savedQueryParameters: advancedSearchUtils.buildURLForAdvancedSavedSearch( filterParametersMap ),
        savedQueryName: 'Discussions'
    } );

    return filterParametersMap;
};

/**
 * getEnglishDateTime
 *
 * @function toMonthName
 * @param {Object}date - monthNumber
 * @return {Object}date
 */
const toMonthName = ( monthNumber ) =>{
    const date = new Date();
    date.setMonth( monthNumber - 1 );

    return date.toLocaleString( 'en-US', {
        month: 'short'
    } );
};

/**
 * getEnglishDateTime
 *
 * @function getEnglishDateTime
 * @param {Object}d - date
 * @return {Object}dformat
 */
const getEnglishDateTime = ( d ) =>{
    return [  d.getDate() < 10 ? '0' + d.getDate() : d.getDate(),
        toMonthName( d.getMonth() + 1 ),
        d.getFullYear() ].join( '-' ) + ' ' +
        [ d.getHours() < 10 ? '0' + d.getHours() : d.getHours(),
            d.getMinutes() < 10 ? '0' + d.getMinutes() : d.getMinutes() ].join( ':' );
};

/**
 * Helper method to return the participant user ids in the correct format
 * @param {*} privParticipantsArray array of participants
 * @returns {String}Semicolon separated string of participant user ids
 */
let buildParticipantStrHelper = function( privParticipantsArray ) {
    // server is expecting a semicolon separated list of participant
    // userids wrapped in parens.
    // Iterate over the array of users, wrap and concatenate with
    // previous values.
    // add a semicolon if this is not the last participant
    let privParticipantsStr = '';
    for( let i = 0; i < privParticipantsArray.length; i++ ) {
        privParticipantsStr += '(' + privParticipantsArray[i] + ')';
        if( i !== privParticipantsArray.length - 1 ) {
            privParticipantsStr += ';';
        }
    }
    return privParticipantsStr;
};

let updateAc0FeedFilterInContext = function( savedQueryAttributes, savedQueryAttributes2, dateMap ) {
    var context = appCtxService.getCtx( 'ac0FeedFilter' );
    if( typeof context === 'undefined' ) {
        context = {};
    }

    // Reset the values to undefined
    context.isPrivate = undefined;
    context.priority = undefined;
    context.privateParticipants = undefined;
    context.status = undefined;
    context.dateCreatedBefore = undefined;
    context.dateCreatedAfter = undefined;

    if( typeof savedQueryAttributes2.ac0PrivateParticipants !== 'undefined' && typeof savedQueryAttributes2.ac0PrivateParticipants.uiValue !== 'undefined' && savedQueryAttributes2.ac0PrivateParticipants.uiValue !== null ) {
        context.privateParticipants = buildParticipantStrHelper( savedQueryAttributes2.ac0PrivateParticipants.dbValues );
    }

    if( typeof savedQueryAttributes.ac0IsPrivate !== 'undefined' && savedQueryAttributes.ac0IsPrivate.dbValue ) {
        context.isPrivate = 'private';
    } else if( typeof savedQueryAttributes.ac0IsPrivate !== 'undefined' && savedQueryAttributes.ac0IsPrivate.dbValue === false ) {
        context.isPrivate = 'public';
    }
    if( typeof savedQueryAttributes.ac0Priority !== 'undefined' && savedQueryAttributes.ac0Priority.dbValue.length > 0 ) {
        var priorityStr = '';
        for( var i = 0; i < savedQueryAttributes.ac0Priority.dbValue.length; i++ ) {
            priorityStr += savedQueryAttributes.ac0Priority.dbValue[ i ];
            if( i < savedQueryAttributes.ac0Priority.dbValue.length - 1 ) {
                priorityStr += ',';
            }
        }
        context.priority = priorityStr;
    }
    if( typeof savedQueryAttributes.ac0Status !== 'undefined' && savedQueryAttributes.ac0Status.dbValue.length > 0 ) {
        var statusStr = '';
        for( var i = 0; i < savedQueryAttributes.ac0Status.dbValue.length; i++ ) {
            statusStr += savedQueryAttributes.ac0Status.dbValue[ i ];
            if( i < savedQueryAttributes.ac0Status.dbValue.length - 1 ) {
                statusStr += ',';
            }
        }
        context.status = statusStr;
    }
    if( typeof dateMap.CommentCreatedAfter !== 'undefined'
        && typeof dateMap.CommentCreatedAfter.uiValue !== 'undefined'
        && dateMap.CommentCreatedAfter.uiValue !== ''
        && dateMap.CommentCreatedAfter.dbValue > -62135579038000 ) {
        context.dateCreatedAfter = getEnglishDateTime( new Date( dateMap.CommentCreatedAfter.dbValue ) );
    }
    if( typeof dateMap.CommentCreatedBefore !== 'undefined'
        && typeof dateMap.CommentCreatedBefore.uiValue !== 'undefined'
        && dateMap.CommentCreatedBefore.uiValue !== ''
        && dateMap.CommentCreatedBefore.dbValue > -62135579038000 ) {
        context.dateCreatedBefore = getEnglishDateTime( new Date( dateMap.CommentCreatedBefore.dbValue ) );
    }

    appCtxService.updateCtx( 'ac0FeedFilter', context );
};

let clearProp = function( prop ) {
    prop.searchText = '';
    if( prop.type === 'DATE' ) {
        prop.newDisplayValues = [ '' ];
        prop.newValue = _dateTimeSvc.getNullDate();
        prop.dbValue = _dateTimeSvc.getNullDate();
        prop.dateApi.dateObject = null;
        prop.dateApi.dateValue = '';
        prop.dateApi.timeValue = '';
        prop.dbValues = [];
        prop.displayValues = [ '' ];
        prop.uiValue = '';
        prop.uiValues = [ '' ];
        prop.value = 0;
    } else {
        var propName = prop.propertyName;
        var propDisplayName = prop.propertyDisplayName;
        if( propName && propDisplayName && ( prop.dbValue || prop.newValue ) ) {
            if( prop.propertyDescriptor && prop.propertyDescriptor.lovCategory === 1 ) {
                prop.dbValue = [];
                prop.value = [];
                prop.displayValsModel = [];
            } else {
                prop.dbValue = '';
                prop.value = '';
            }
            prop.dbValues = [];
            prop.displayValues = [];
            prop.uiValue = '';
            prop.uiValues = [];
            prop.newValue = '';
            prop.newDisplayValues = [];
        }
    }
    return prop;
};
/**
 * clearAllAction
 * @function clearAllAction
 * @param {Object}data - the view model data
 * @returns {Object} newAttributes
 */
export let clearAllAction = function( data ) {
    let newAttributes = _.cloneDeep( data );
    if( typeof data !== 'undefined' ) {
        newAttributes.awp0AdvancedQueryAttributes.props.ac0IsPrivate = clearProp( newAttributes.awp0AdvancedQueryAttributes.props.ac0IsPrivate );
        newAttributes.awp0AdvancedQueryAttributes.props.ac0Priority = clearProp( newAttributes.awp0AdvancedQueryAttributes.props.ac0Priority );
        newAttributes.awp0AdvancedQueryAttributes.props.ac0Status = clearProp( newAttributes.awp0AdvancedQueryAttributes.props.ac0Status );
        newAttributes.awp0AdvancedQueryAttributes2.props.ac0PrivateParticipants = clearProp( newAttributes.awp0AdvancedQueryAttributes2.props.ac0PrivateParticipants );
        newAttributes.dateCreatedAfter = clearProp( newAttributes.dateCreatedAfter );
        newAttributes.dateCreatedBefore = clearProp( newAttributes.dateCreatedBefore );
    }
    return newAttributes;
};

/**
 * clearFilterPanelDirtyFlagsAction
 * @function clearFilterPanelDirtyFlagsAction
 * @param {Object}data - the view model data
 * @returns {Object} newAttributes
 */
export let clearFilterPanelDirtyFlagsAction = function( data ) {
    let newAttributes = _.cloneDeep( data );
    if( typeof data !== 'undefined' ) {
        newAttributes.awp0AdvancedQueryAttributes.props.ac0IsPrivate.valueUpdated = false;
        newAttributes.awp0AdvancedQueryAttributes.props.ac0Priority.valueUpdated = false;
        newAttributes.awp0AdvancedQueryAttributes.props.ac0Status.valueUpdated = false;
        newAttributes.awp0AdvancedQueryAttributes2.props.ac0PrivateParticipants.valueUpdated = false;
        newAttributes.dateCreatedAfter.valueUpdated = false;
        newAttributes.dateCreatedBefore.valueUpdated = false;
    }
    return newAttributes;
};

export let loadFilterPropData = async function( data ) {
    const queryUID = _.clone( data );

    var deferred = AwPromiseService.instance.defer();
    var promiseArray = [];

    var ac0Filters3 = {};
    var serviceInput = {
        selectedQuery: {
            type: 'ImanQuery',
            uid: queryUID
        }
    };

    promiseArray.push(
        soaSvc.post( 'Internal-AWS2-2016-12-AdvancedSearch', 'getSelectedQueryCriteria', serviceInput ).then( function( responseData ) {
            ac0Filters3 = getFilterPropsFromSelectedQueryCriteria( responseData, queryUID );
        }, function( reason ) {
            messagingService.showError( reason.toString() );
        } )
    );

    return Promise.all( promiseArray ).then( () => {
        deferred.resolve(  ac0Filters3  );
    } );
};

/**
 * updateOrClearFilterAttributes
 * @function updateOrClearFilterAttributes
 * @param {*} ac0FeedFilterQueryUID - ac0FeedFilterQueryUID
 * @param {*} advancedQueryAttributeModelObject - advancedQueryAttributeModelObject
 * @param {string}searchState - the search type
 * @return {Object} AdvancedQueryAttributes
 */
export let updateOrClearFilterAttributes = function( ac0FeedFilterQueryUID, advancedQueryAttributeModelObject, searchState ) {
    var searchUid = ac0FeedFilterQueryUID;
    var modelObject = advancedQueryAttributeModelObject;
    var attributesViewModelObj = advancedSearchService.processAttributesViewModelObj( advancedSearchService.createAttributesViewModelObject( searchUid, modelObject ) );

    return advancedSearchUtils.populateQueryAttributesForSavedSearch( attributesViewModelObj, searchState.savedQueryAttributes );
};

/**
 * updateOrClearFilterAttributes2
 * @function updateOrClearFilterAttributes2
 * @param {*} ac0FeedFilterQueryUID2 - ac0FeedFilterQueryUID2
 * @param {*} advancedQueryAttributeModelObject2 - advancedQueryAttributeModelObject2
 * @param {*} awp0AdvancedQueryAttributes - awp0AdvancedQueryAttributes
 * @param {string} searchState - searchState
 * @return {Object} AdvancedQueryAttributes
 */
export let updateOrClearFilterAttributes2 = async function( ac0FeedFilterQueryUID2, advancedQueryAttributeModelObject2, awp0AdvancedQueryAttributes, searchState ) {
    var searchUid = ac0FeedFilterQueryUID2;
    var modelObject = advancedQueryAttributeModelObject2;
    var attributesViewModelObj = advancedSearchService.processAttributesViewModelObj( advancedSearchService.createAttributesViewModelObject( searchUid, modelObject ) );

    var tmpAttributes = await advancedSearchUtils.populateQueryAttributesForSavedSearch( attributesViewModelObj, searchState.savedQueryAttributes );
    var existingAttributes = awp0AdvancedQueryAttributes;

    tmpAttributes.props.ac0PrivateParticipants.propertyDisplayName = existingAttributes.props.ac0PrivateParticipants.propertyDisplayName;
    tmpAttributes.propertyDescriptors.ac0PrivateParticipants.displayName = existingAttributes.propertyDescriptors.ac0PrivateParticipants.displayName;

    delete existingAttributes.props.ac0PrivateParticipants;
    delete existingAttributes.propertyDescriptors.ac0PrivateParticipants;

    return tmpAttributes;
};

/**
 * updateOrClearFilterAttributes3
 * @param {*} dateCreatedAfter - dateCreatedAfter
 * @param {*} dateCreatedBefore - dateCreatedBefore
 * @param {*} searchState - searchState
 * @returns {Object} AdvancedQueryAttributes
 */
export let updateOrClearFilterAttributes3 = function( dateCreatedAfter, dateCreatedBefore, searchState ) {
    var tmpAttributes = {
        props : [ dateCreatedAfter, dateCreatedBefore ]
    };
    return advancedSearchUtils.populateQueryAttributesForSavedSearch( tmpAttributes, searchState.savedQueryAttributes );
};

/**
 * updateFilterAttributesWithSelectedQuery
 *
 * @function updateFilterAttributesWithSelectedQuery
 * @param {Object}response - response from SOA getSelectedQueryCriteria
 * @return {Object} SavedQuery
 */
export let updateFilterAttributesWithSelectedQuery = function( response ) {
    var cdmObj = clientDataModel.getObject( response.advancedQueryCriteria.uid );
    var key = '0_ac0PrivateParticipants';
    cdmObj.props[key].propertyDescriptor.lovCategory = 1;
    return cdmObj;
};

const exports = {
    getFilterPropsFromSelectedQueryCriteria,
    getFilterPropsFromSelectedQueryCriteriaAddUsers,
    doFeedFiltering,
    clearAllAction,
    loadFilterPropData,
    updateOrClearFilterAttributes,
    updateOrClearFilterAttributes2,
    updateOrClearFilterAttributes3,
    updateFilterAttributesWithSelectedQuery,
    clearFilterPanelDirtyFlagsAction
};

export default exports;
