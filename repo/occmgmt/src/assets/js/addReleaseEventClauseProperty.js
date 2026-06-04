//@<COPYRIGHT>@
//==================================================
//Copyright 2022.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@


/**
 * @module js/addReleaseEventClauseProperty
 */
import app from 'app';
import revisionRuleAdminCtx from 'js/revisionRuleAdminContextService';
import revRuleClauseDisplayTextService from 'js/revRuleClauseDisplayTextService';
import cdmSvc from 'soa/kernel/clientDataModel';
import viewModelObjectSvc from 'js/viewModelObjectService';
import _ from 'lodash';
import addRevRuleClausePropertyService from  'js/addRevRuleClausePropertyService';


var _release_event = 'Fnd0ReleaseEvent';
var ADDCLAUSE_PREFIX = 'addClause_';
var exports = {};

/**
 * Get updated Release Event clause
 *
 * @param {DeclViewModel} data - RevisionRuleAdminPanelViewModel
 * @param {Object} clauseToBeUpdated - modified/added clause
 * @param {Boolean} isForAddClause - true if clause is added from AddClause panel
 *
 */

export let getUpdatedReleaseEventClause = function( data, clauseToBeUpdated, isForAddClause ) {
    var ctx = revisionRuleAdminCtx.getCtx();
    var release_event = undefined;
    var event_type = _release_event;

    if( clauseToBeUpdated.entryType === 13 ) {
        if( isForAddClause ) {
            event_type = ADDCLAUSE_PREFIX + _release_event;
        }

        clauseToBeUpdated.revRuleEntryKeyToValue = {};
        var displayText = revRuleClauseDisplayTextService.getDisplayTextForClause( data, clauseToBeUpdated.entryType, isForAddClause );
        if( ctx.RevisionRuleAdmin[ event_type ] ) {
            release_event = ctx.RevisionRuleAdmin[ event_type ].uid;
            clauseToBeUpdated.revRuleEntryKeyToValue.release_event = release_event;
        }

        if( !isForAddClause ) {
            return addRevRuleClausePropertyService.modifyClauseProperty( data, clauseToBeUpdated, displayText );
        }
        addRevRuleClausePropertyService.createClausePropertyForAddClause( clauseToBeUpdated, displayText );
    }
};
/**
 * Update event clause text
 *
 * @param {DeclViewModel} data - RevisionRuleAdminPanelViewModel
 *
 */
export let updateReleaseEventClauseText = function( data ) {
    var clauseToBeUpdated = addRevRuleClausePropertyService.getSelectedClause( data.subPanelContext );
    if( clauseToBeUpdated && clauseToBeUpdated.entryType === 13 ) {
        return exports.getUpdatedReleaseEventClause( data, clauseToBeUpdated, false );
    }
};

/**
 * Update the release event property with the selected property from the widget
 *
 * @param {DeclViewModel} data - RevisionRuleAdminClausePropertiesViewModel
 *
 */
export let eventListSelectionChanged = function( data ) {
    var islovValueModified = false;

    if( data.release_event.dbValue !== '' ) {
        islovValueModified = true;
    }
    if( islovValueModified ) {
        var subPanelContext = data.subPanelContext;
        if( subPanelContext ) {
            var isSelectedFromAddPanel = subPanelContext.activeView && subPanelContext.activeView === 'AddClauses';
        }
        var object = {};

        var release_event_type = addRevRuleClausePropertyService.getClausePropertiesType( _release_event, data );
        if( data.release_event.dbValue !== '' ) {
            object = cdmSvc.getObject( data.release_event.dbValue );
        } else {
            revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( release_event_type, undefined );
        }
        if( object && object.uid ) {
            var vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( object, 'EDIT' );
            revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( release_event_type, vmo );
        }
        if( !isSelectedFromAddPanel ) {
            updateReleaseEventClauseText( data );
        }
    }
};

/**
 * Get the search string value for SOA input to fetch the release event clause property values
 *
 * @param {DeclViewModel} data - RevisionRuleAdminPanelViewModel
 * @return {String} searchString - Search string for SOA input to fetch the clause property values
 *
 */
export let getSearchStringValueForEvent = function( data ) {
    var ctx = revisionRuleAdminCtx.getCtx();
    var searchString = '';

    var release_event_type = addRevRuleClausePropertyService.getClausePropertiesType( _release_event, data );
    if( data.release_event.uiValue && !( ctx.RevisionRuleAdmin[ release_event_type ] && data.release_event.uiValue === ctx.RevisionRuleAdmin[ release_event_type ].props.object_string.dbValue ) ) {
        searchString = data.release_event.uiValue;
    }
    return searchString;
};

/**
 * Process SOA response and add the release events to the widget dataprovider
 *
 * @param {Object} response - performSearch SOA response
 * @param {DeclViewModel} data - RevisionRuleAdminPanelViewModel
 * @return {StringArray} response value for dataprovider
 *
 */
export let processReleaseEventSearchResults = function( response, data ) {
    var releaseEventsList = [];
    var result;
    let moreValuesExist = false;

    if( response.searchResults ) {
        result = response.searchResults;
        moreValuesExist = data.dataProviders.eventsListProvider.startIndex + response.totalLoaded < response.totalFound; // for pagination
    }

    var property = {
        propDisplayValue: '',
        propInternalValue: '',
        object: ''
    };
    if( result ) {
        for( var ii = 0; ii < result.length; ii++ ) {
            property = {
                propDisplayValue: result[ ii ].props.fnd0Name.uiValues[ 0 ],
                propInternalValue: result[ ii ].uid,
                object: result[ ii ]
            };
            releaseEventsList.push( property );
        }
    }
    var ctx = revisionRuleAdminCtx.getCtx();
    var release_event_type = addRevRuleClausePropertyService.getClausePropertiesType( _release_event, data );
    if( result && data.release_event.uiValue === '' && ctx.RevisionRuleAdmin[ release_event_type ] === undefined ) {
        let releaseEvent = _.cloneDeep( data.release_event );
        releaseEvent.dbValue = releaseEventsList[0].propInternalValue;
        releaseEvent.uiValue = releaseEventsList[0].propDisplayValue;

        let object = cdmSvc.getObject( releaseEvent.dbValue );
        let vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( object, 'EDIT' );
        revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( release_event_type, vmo );

        data.dispatch( { path: 'data.release_event', value: releaseEvent } );
    }

    return { releaseEventsList, moreValuesExist };
};

/**
 * Validate the input to the event widget value
 *
 * @param {DeclViewModel} data - RevisionRuleAdminClausePropertiesViewModel
 *
 */
export let validateEventWidgetValue = function( data ) {
    var ctx = revisionRuleAdminCtx.getCtx();
    var release_event_type = addRevRuleClausePropertyService.getClausePropertiesType( _release_event, data );
    let validEvent = true;
    let releaseEvent = _.cloneDeep( data.release_event );
    //release event will be valid if either the widget inputText is equal to the release event value in ctx
    // or widget inputText is present in the dataprovider
    var indexOfEvent = -1;
    if( data.dataProviders.eventsListProvider.viewModelCollection.loadedVMObjects.length > 0 && releaseEvent.uiValue !== '' ) {
        indexOfEvent = data.dataProviders.eventsListProvider.viewModelCollection.loadedVMObjects
            .map( function( x ) {
                return x.object.uid;
            } ).indexOf( releaseEvent.dbValue );
    }
    if( indexOfEvent < 0 && !( releaseEvent.uiValue === '' || ctx.RevisionRuleAdmin[ release_event_type ] && releaseEvent.uiValue === ctx.RevisionRuleAdmin[ release_event_type ].props.fnd0Name.dbValue ) ) {
        data.validEvent = false;
        if( ctx.RevisionRuleAdmin[ release_event_type ] ) {
            releaseEvent.dbValue = ctx.RevisionRuleAdmin[ release_event_type ].uid;
            releaseEvent.uiValue = ctx.RevisionRuleAdmin[ release_event_type ].props.fnd0Name.dbValue;
        } else {
            releaseEvent.dbValue = '';
            releaseEvent.uiValue = '';
        }
        data.dispatch( { path: 'data.release_event', value: releaseEvent } );
    }
    return { valid: validEvent, message: '' };
};

/**
 * Initialize the event clause property when any clause is selected from the list of clauses
 *
 * @param {DeclViewModel} data - RevisionRuleAdminClausePropertiesViewModel
 *
 */
export let eventClausePropertyValueInitialized = function( data ) {
    var ctx = revisionRuleAdminCtx.getCtx();
    var  releaseEvent = _.cloneDeep( data.release_event );
    if( ctx.RevisionRuleAdmin.Fnd0ReleaseEvent ) {
        releaseEvent.uiValue = ctx.RevisionRuleAdmin.Fnd0ReleaseEvent.props.fnd0Name.dbValue;
        releaseEvent.dbValue = ctx.RevisionRuleAdmin.Fnd0ReleaseEvent.uid;
    } else {
        releaseEvent.uiValue = '';
        releaseEvent.dbValue = '';
        data.currentEvent.dbValue = false;
    }
    return releaseEvent;
};


export let updateWidgetTextForReleaseEventClauseProperty = function( data ) {
    let releaseEvent = _.cloneDeep(  data.release_event );

    if( data.currentEvent && data.release_event !== releaseEvent.uid ) {
        releaseEvent.uiValue = releaseEvent.props.object_string.dbValues[ 0 ];
        releaseEvent.dbValue = releaseEvent.uid;
    } else if( data.dbValue === releaseEvent.uid ) {
        releaseEvent.uiValue = '';
        releaseEvent.dbValue = '';
        //exports.eventListSelectionChanged( data );
    }
    return releaseEvent;
};
export default exports = {
    getUpdatedReleaseEventClause,
    eventClausePropertyValueInitialized,
    processReleaseEventSearchResults,
    eventListSelectionChanged,
    getSearchStringValueForEvent,
    validateEventWidgetValue,
    updateReleaseEventClauseText,
    updateWidgetTextForReleaseEventClauseProperty
};
/**
 * @memberof NgServices
 * @member acerevisionRuleAdminPanelService
 */
app.factory( 'addReleaseEventClauseProperty', () => exports );
