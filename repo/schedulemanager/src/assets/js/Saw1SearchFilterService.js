// Copyright 2018 Siemens Product Lifecycle Management Software Inc.
/**
 * Service that provides utility APIs for Schedule/ScheduleTask search filter.
 *
 * @module js/Saw1SearchFilterService
 */
import AwStateService from 'js/awStateService';
import eventBus from 'js/eventBus';
import awSearchService from 'js/awSearchService';
import _ from 'lodash';

var exports = {};

/**
 * Initializes the list box value.
 *
 * @function initialize
 * @param {Object} data data
 */
export let initialize = function( data ) {
    data.privilege.dbValue = AwStateService.instance.params.privilege;
};

export let processOutput = function( data, dataCtxNode, searchData ) {
    awSearchService.processOutput( data, dataCtxNode, searchData );
};

var _getEmptyListModel = function() {
    return {
        propDisplayValue: '',
        propInternalValue: '',
        propDisplayDescription: '',
        hasChildren: false,
        children: {},
        sel: false
    };
};

export let populatePrivilegeList = function( data ) {
    var privilegeListArray = [];

    var listModel = _getEmptyListModel();
    listModel.propDisplayValue = data.i18n.coordinator;
    listModel.propInternalValue = 'coordinator';
    privilegeListArray.push( listModel );

    var listModel1 = _getEmptyListModel();
    listModel1.propDisplayValue = data.i18n.participant;
    listModel1.propInternalValue = 'participant';
    privilegeListArray.push( listModel1 );

    var listModel2 = _getEmptyListModel();
    listModel2.propDisplayValue = data.i18n.observer;
    listModel2.propInternalValue = 'observer';
    privilegeListArray.push( listModel2 );

    let newPrivilegeList = _.clone( data.privilegeList );
    newPrivilegeList = privilegeListArray;

    let newPrivilege = _.clone( data.privilege );
    if( AwStateService.instance.params.privilege ) {
        newPrivilege.dbValue = AwStateService.instance.params.privilege;
        newPrivilege.uiValue = data.i18n[ data.privilege.dbValue ];
    } else {
        newPrivilege.dbValue = privilegeListArray[ 0 ].propInternalValue;
        newPrivilege.uiValue = privilegeListArray[ 0 ].propDisplayValue;
        AwStateService.instance.go( '.', {
            filter: '',
            privilege: newPrivilege.dbValue
        } );
    }
    return {
        privilegeList : newPrivilegeList,
        privilege : newPrivilege
    };
};

export let prepareAdditionalContextList = function( data ) {
    if( AwStateService.instance.params.hasOwnProperty( 'team' ) ) {
        var additionalContextArray = [];

        // Add the default "All" at the top of the list.
        var listModel = _getEmptyListModel();
        listModel.propInternalValue = 'allTeams';
        listModel.propDisplayValue = data.i18n.allTeams;
        additionalContextArray.push( listModel );

        if( data.resourcePoolSearchResults && data.resourcePoolSearchResults.length > 0 ) {
            for( var i = 0; i < data.resourcePoolSearchResults.length; ++i ) {
                var objectUid = data.resourcePoolSearchResults[ i ].uid;
                var modelObject = data.resourcePoolModelObjects[ objectUid ];

                if( modelObject && modelObject.props.object_string ) {
                    var listModel1 = _getEmptyListModel();
                    listModel1.propInternalValue = objectUid;
                    listModel1.propDisplayValue = modelObject.props.object_string.uiValues[ 0 ];
                    additionalContextArray.push( listModel1 );
                }
            }
        }

        let newAdditionalContextList = _.clone( data.additionalContextList );
        newAdditionalContextList = additionalContextArray;

        let newAdditionalContext = _.clone( data.additionalContext );
        if( AwStateService.instance.params.team ) {
            newAdditionalContext.dbValue = AwStateService.instance.params.team;
        } else {
            newAdditionalContext.dbValue = additionalContextArray[ 0 ].propInternalValue;
            AwStateService.instance.go( '.', {
                filter: '',
                team: newAdditionalContext.dbValue
            } );
        }
        return {
            additionalContextList : newAdditionalContextList,
            additionalContext: newAdditionalContext
        };
    }
};

/**
 * Sets the selected additional search context as the new params and
 * re-run the search.
 *
 * @function setSelectedContext
 * @param {Object} data data
 */
export let setSelectedContext = function( data ) {
    if( AwStateService.instance.params.hasOwnProperty( 'team' ) ) {
        var activeFilter = AwStateService.instance.params.filter;
        var currentInbox = AwStateService.instance.params.team;

        if( currentInbox !== data.additionalContext.dbValue ) {
            AwStateService.instance.go( '.', {
                filter: '', // Clear the filters when the team is changed.
                team: data.additionalContext.dbValue
            } );

            if( !activeFilter ) {
                eventBus.publish( 'primaryWorkarea.reset' );
            }
        }
    }
};

/**
 * Sets the selected privilege as the new params and
 * re-run the search.
 *
 * @function setSelectedPrivilege
 * @param {Object} data data
 */
export let setSelectedPrivilege = function( data ) {
    var currentRole = AwStateService.instance.params.privilege;
    var activeFilter = AwStateService.instance.params.filter;

    if( currentRole !== data.subPanelContext.searchState.criteria.privilege ) {
        AwStateService.instance.go( '.', {
            filter: '', // Clear the filters when the privilege is changed.
            privilege: data.subPanelContext.searchState.criteria.privilege
        } );

        if( !activeFilter ) {
            eventBus.publish( 'primaryWorkarea.reset' );
        }
    }
};

/**
 * Returns the schedules search criteria that includes the privilege criteria.
 *
 * @function getSchedulesSearchCriteria
 * @param {string} additionalContext
 * @param {Object} searchCriteria search params
 */
export let getSchedulesSearchCriteria = function( additionalContext, searchCriteria ) {
    if( additionalContext ) {
        searchCriteria.team = additionalContext;
    }
    return searchCriteria;
};

/**
 * Update the schedules search criteria that includes the privilege criteria.
 *
 * @function getSchedulesSearchCriteria
 * @param {Object} newPrivilege string
 * @param {Object} searchState searchState Object
 */
export let updateSchedulesSearchCriteria = function( newPrivilege, searchState ) {
    const newSearchState = { ...searchState.getValue() };
    newSearchState.criteria.privilege = newPrivilege;
    searchState.update( newSearchState );
};

export default exports = {
    initialize,
    processOutput,
    populatePrivilegeList,
    prepareAdditionalContextList,
    setSelectedContext,
    setSelectedPrivilege,
    getSchedulesSearchCriteria,
    updateSchedulesSearchCriteria
};

