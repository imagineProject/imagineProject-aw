// Copyright (c) 2022 Siemens

/**
 * This implements the Key roles functionality that need to be shown on UI.
 *
 * @module js/Awp0WorkflowKeyRoles
 */
import Awp0WorkflowDesignerUtils from 'js/Awp0WorkflowDesignerUtils';
import _ from 'lodash';
import searchFilterSvc from 'js/aw.searchFilter.service';

var exports = {};


/**
 * Get all objects that need to be shown as key roles.
 *
 * @param {Object} response Response object that will contain all dynamic participants
 * @param {Array} memberList Workflow member realted keyword list
 * @param {Array} projectMemberList Project related keyword list
 * @returns {Array} Key role objects that will be shown on key roles panel
 */
export let getAllKeyRoleObjects = function( response, memberList, projectMemberList ) {
    var dynamicParticipants = [];
    // Get all dynamic participants need to be shown
    if( response && response.searchFilterCategories ) {
        var dpKeyRoles = [];
        _.forEach( response.searchFilterCategories, function( dpKeyRole ) {
            if( dpKeyRole ) {
                dpKeyRole.typeName = 'dynamicParticipants';
                dpKeyRoles.push( dpKeyRole );
            }
        } );
        dynamicParticipants = Awp0WorkflowDesignerUtils.createKeyRoleObjects( dpKeyRoles, false, null );
    }
    // Get all workflow specific handler keyword list and show them as key role users
    if( memberList ) {
        var workflowMembers = Awp0WorkflowDesignerUtils.createKeyRoleObjects( memberList, false, null );
        if( workflowMembers && !_.isEmpty( workflowMembers ) ) {
            Array.prototype.push.apply( dynamicParticipants, workflowMembers );
        }
    }
    // Get all project specific handler keyword list and show them as key role users
    if( projectMemberList ) {
        var projectMembers = Awp0WorkflowDesignerUtils.createKeyRoleObjects( projectMemberList, false, null );
        if( projectMembers && !_.isEmpty( projectMembers ) ) {
            Array.prototype.push.apply( dynamicParticipants, projectMembers );
        }
    }
    // Sort all key roles using KeyRole property
    dynamicParticipants = Awp0WorkflowDesignerUtils.sortModelObjectsByProp( dynamicParticipants, 'keyRole', true );
    return dynamicParticipants;
};

/**
  * Using regual expression update the special characters and return the correct string.
  *
  * @param {String} string Filter string that need to be updated
  * @param {Char} char with string will be updated
  *
  * @returns {String} Replace string
  */
var _replaceRegExpChars = function( string, char ) {
    var charExp = new RegExp( char, 'g' );
    return string.replace( charExp, char );
};

/**
  * This generates a regular expression that can be used for
  * @param {String} filterString string that we will be generating the regex for
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
  * Get the input object property and return the internal or display value.
  *
  * @param {Object} modelObject Model object whose propeties need to be loaded
  * @param {String} propName Property name that need to be checked
  * @param {boolean} isDispValue Display value need to be get or internal value
  *
  * @returns {Array} Property internal value or display value
  */
var _getPropValue = function( modelObject, propName, isDispValue ) {
    var propValue = null;
    if( modelObject && modelObject.props && modelObject.props[ propName ] ) {
        var values = null;
        if( isDispValue ) {
            values = modelObject.props[ propName ].uiValues;
        } else {
            values = modelObject.props[ propName ].dbValues;
        }
        if( values && values[ 0 ] ) {
            propValue = values[ 0 ];
        }
    }
    return propValue;
};

/**
 * Filter present key role objects based on input filter string.
 *
 * @param {Array} keyRoleObjects All key role objects
 * @param {String} filterString Filter string for key roles needs to be filtered.
 *
 * @returns {Array} Filter key role objects
 */
export let showAvailableKeyRoles = function( keyRoleObjects, filterString ) {
    var searchResults = keyRoleObjects;
    // Check if user input filter string is not null and not '*' then we need to filter
    // all available sites based in user input string.
    if( filterString && filterString.trim() !== '' && filterString.trim() !== '*' ) {
        //If there are space in filter string then replace it with * so that it can find the results correctly
        var regExpString = _generateRegenx( filterString ).split( ' ' ).join( '*' );
        var finalRexString = '*' + regExpString + '*';
        var regExp = new RegExp( finalRexString.replace( /[*]/ig, '.*' ), 'ig' );
        var localSites = _.clone( searchResults );
        searchResults = localSites.filter( function( vmoObject ) {
            // This is needed to reset the lastIndex after first match is done as it regex stored the last index value
            // and before the match beign we should reset it to default value 0.
            regExp.lastIndex = 0;
            // Filering based on two properties key role and key role type
            var propValue = _getPropValue( vmoObject, 'keyRole' );
            var keyRoleTypeValue = _getPropValue( vmoObject, 'keyRoleType' );
            if( regExp.test( propValue ) || regExp.test( keyRoleTypeValue ) ) {
                return true;
            }
        } );
    }
    return searchResults;
};


/**
 * Return if selectiom mode is multiple then return true else return false..
 *
 * @param {Object} multiSelectMode - To define that multi select mode is enabled or not
 *
 * @return {boolean} The boolean value to tell that multi select mode is enabled or not
 */

export let getMultiSelectMode = function( multiSelectMode ) {
    if( multiSelectMode && multiSelectMode === 'multiple' ) {
        return true;
    }
    return false;
};

/**
 * Get the select object from provider from UI and add to the input sub panel context so that it can be consume
 * further to display on UI.
 *
 * @param {Boolean} multiSelectEnabled - The multiple select enabled or not
 * @param {Array} selection - The selection object array
 * @param {Object} subPanelContext Add user panel context object
 */
export let addUserObject = function( multiSelectEnabled, selection, subPanelContext ) {
    // Check if context is not null and selection is also not null then we need to set
    // the selected users on context based on selection mode.
    if( subPanelContext && selection ) {
        var selectedUsers = [];
        // In case of multiple selection mode then we need add input selection as selected users else
        // we will use 0th index object as selected users.
        if( multiSelectEnabled ) {
            selectedUsers = selection;
        } else if( !multiSelectEnabled && selection[ 0 ] ) {
            selectedUsers = [ selection[ 0 ] ];
        }
        // Update the context with selected users
        let localContext = { ...subPanelContext.value };
        localContext.selectedUsers = selectedUsers;
        subPanelContext.update && subPanelContext.update( localContext );
    }
};

/**
 * Build the crumb title that need to be shown for key roles.
 * @param {String} searchString - Search string user is filtering key roles
 * @param {Object} totalFound Total found objects matching the criteria
 * @return {Promise} Promise containing the localized text
 */
export let buildCrumbTitle = function( searchString, totalFound ) {
    var label = {
        source: '/i18n/SearchMessages',
        key: 'resultsText'
    };
    // Check if input search string is not null then build the crumb title that need to be shown on UI.
    if( searchString ) {
        return searchFilterSvc.loadBreadcrumbTitle( label, searchString, totalFound ).then( ( localizedText ) => {
            return localizedText;
        } );
    }

    return Promise.resolve( {} );
};

/**
 * Based on selection mode return true/false string to indicate we need multi user DP's or not.
 *
 * @param {String} selectionMode Selection mode string
 * @returns {String} empty string/false string value to indicate we need multi participants or not
 */
export let getParticipantMultipleAssignee = function( selectionMode ) {
    // This is special processing when we can add multiple users then we pass it as
    // empty string so it can show single/multi DP's as well.
    var multipleAssigenee = '';
    if( selectionMode && selectionMode === 'single' ) {
        multipleAssigenee = 'false';
    }
    return multipleAssigenee;
};


/**
  * Get the selectionMode from parent component and set it for search tab component.
  *
  * @param {String} selectionMode - selection mode - 'single'/'multiple'
  * @param {Object} selectionModels - selection models for the search tab view model
  * @returns {Object} updatedSelectionModels - the updated selectionModels for search tab view model
  */
export let initializeSelectionModel = ( selectionMode, selectionModels ) => {
    let updatedSelectionModels = _.cloneDeep( selectionModels );
    if( selectionMode && selectionMode.length > 0 ) {
        updatedSelectionModels.keyRolesSelectionModel.setMode( selectionMode );
    }
    return updatedSelectionModels;
};


export default exports = {
    getMultiSelectMode,
    getAllKeyRoleObjects,
    showAvailableKeyRoles,
    addUserObject,
    buildCrumbTitle,
    getParticipantMultipleAssignee,
    initializeSelectionModel
};
