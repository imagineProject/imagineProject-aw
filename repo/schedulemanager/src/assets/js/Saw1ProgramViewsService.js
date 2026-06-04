// Copyright 2019 Siemens Product Lifecycle Management Software Inc.
/**
 * Service that provides utility APIs for Program Views.
 *
 * @module js/Saw1ProgramViewsService
 */
import AwStateService from 'js/awStateService';
import appCtxService from 'js/appCtxService';
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
    data.option.dbValue = AwStateService.instance.params.option;
};

export let processOutput = function( data, dataCtxNode, searchData ) {
    awSearchService.processOutput( data, dataCtxNode, searchData );
};


var _getEmptyListModel = function _getEmptyListModel() {
    return {
        propDisplayValue: '',
        propInternalValue: '',
        propDisplayDescription: '',
        hasChildren: false,
        children: {},
        sel: false
    };
};

export let getProgramViewsOptions = function( data ) {
    var optionListArray = [];

    var listModel = _getEmptyListModel();

    listModel.propDisplayValue = data.i18n.myProgramViews;
    listModel.propInternalValue = 'myProgramViews';
    optionListArray.push( listModel );

    var allPrgViewListModel = _getEmptyListModel();

    allPrgViewListModel.propDisplayValue = data.i18n.allProgramViews;
    allPrgViewListModel.propInternalValue = 'allProgramViews';
    optionListArray.push( allPrgViewListModel );

    let newOptionList = _.clone( data.optionList );
    newOptionList = optionListArray;

    return {
        optionList : newOptionList
    };
};

/**
 * Sets the selected option as the new params and
 * re-run the search.
 *
 * @function setSelectedProgramViewsOption
 * @param {Object} data data
 */
export let setSelectedProgramViewsOption = function( data ) {
    var currentRole = AwStateService.instance.params.option;
    var activeFilter = AwStateService.instance.params.filter;

    if( currentRole !== data.option.dbValue ) {
        AwStateService.instance.go( '.', {
            filter: '', // Clear the filters when the option is changed.
            option: data.option.dbValue
        } );

        if( !activeFilter ) {
            eventBus.publish( 'primaryWorkarea.reset' );
        }
    }
};

/**
 * Returns the Program Views search criteria that includes the option criteria.
 *
 * @function getProgramViewsSearchCriteria
 * @param {Object} stateParams state params
 * @param {Object} searchCriteria search params
 * @returns {Object} The search criteria
 */
export let getProgramViewsSearchCriteria = function( option, searchCriteria ) {
    var userCtx = appCtxService.getCtx( 'user' );
    var userSessionCtx = appCtxService.getCtx( 'userSession' );

    searchCriteria.DatasetType = 'ProgramView';

    searchCriteria.queryName = 'Dataset...';
    searchCriteria.typeOfSearch = 'ADVANCED_SEARCH';
    searchCriteria.lastEndIndex = '0';

    /** For the firt time this is empty since option value is initialized later on. Hence updating it to myProgramView.
    */
    if( option === '' ) {
        option = 'myProgramViews';
    }

    if( option === 'myProgramViews' ) {
        searchCriteria.OwningUser = userCtx.cellHeader2;
        searchCriteria.OwningGroup = userSessionCtx.props.group.uiValues[0];
    } else {
        searchCriteria.OwningUser = '*';
        searchCriteria.OwningGroup = '*';
    }

    if( option ) {
        searchCriteria.option = option;
    }
    return searchCriteria;
};

export default exports = {
    initialize,
    processOutput,
    getProgramViewsOptions,
    setSelectedProgramViewsOption,
    getProgramViewsSearchCriteria
};
