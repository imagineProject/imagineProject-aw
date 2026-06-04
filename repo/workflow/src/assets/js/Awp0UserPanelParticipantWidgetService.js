// Copyright (c) 2022 Siemens

/**
 * This service handler the workflow specific popup panel needs.
 * @module js/Awp0UserPanelParticipantWidgetService
 */

import _ from 'lodash';

var exports = {};

/**
  * Return an empty ListModel object.
  *
  * @return {Object} - Empty ListModel object.
  */
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

/**
  * Populate participant types data that can be assined.
  *
  * @param {Object} propObject Participant property object
  * @param {Object} subPanelContext context object
  * @param {Object} assignableParticipants Assignable particiapnt array
  *
  * @returns {Object} Participant type info object
  */
export let populateParticipantTypesData = function( propObject, subPanelContext, assignableParticipants ) {
    var assignableParticipantTypes = [];
    var isValueUpdated = false;

    if( subPanelContext && subPanelContext.assignableParticipantTypes ) {
        var participantTypeObjects = subPanelContext.assignableParticipantTypes;
        if( assignableParticipants ) {
            participantTypeObjects = assignableParticipants;
        }

        // Iterate for each object object
        var participantTypeList = [];
        _.forEach( participantTypeObjects, function( participantObj ) {
            var listModelObject = _getEmptyListModel();
            listModelObject.propInternalValue = participantObj.propInternalValue;
            listModelObject.propDisplayValue = participantObj.propDisplayValue;
            participantTypeList.push( listModelObject );
        } );
        // Set the assignable participant types that need to be shown on UI.
        if( participantTypeList && !_.isEmpty( participantTypeList ) ) {
            assignableParticipantTypes = participantTypeList;
        }
    }
    // Check if widget is present then set the 0th value as default value
    const participantProp = { ...propObject };
    if( participantProp ) {
        participantProp.dbValue = '';
        participantProp.uiValue = '';
        var defaultParticipantValue = null;


        // Select the default participant name
        if( participantTypeList && participantTypeList.length > 0 && participantTypeList[ 0 ] ) {
            defaultParticipantValue = participantTypeList[ 0 ];
            var participantTypeToSelect = null;
            // Check if user has selected participant type from participant table then we need
            // to set that type by default in the participant list or if user selected some particiapnt type
            // value from list and then swtich tabs like resource pool to user or user to resource pool or panel is pinned
            // then we need to retain that selection.
            if( subPanelContext.criteria && subPanelContext.criteria.participantType ) {
                participantTypeToSelect = subPanelContext.criteria.participantType;
            } else if( subPanelContext.selectedParticipant && subPanelContext.selectedParticipant.participantType ) {
                participantTypeToSelect = subPanelContext.selectedParticipant.participantType;
            }

            // Check if user has selected participant type from participant table then we need
            // to set that type by default in the participant list.
            if( participantTypeToSelect ) {
                // Get the participant type LOV object from list and then if found set it default selection
                var matchParticipant = _.find( participantTypeList, function( participantValue ) {
                    return participantValue && participantValue.propInternalValue === participantTypeToSelect;
                } );
                if( matchParticipant ) {
                    defaultParticipantValue = matchParticipant;
                }
            }
            // Set the default value in listbox
            if( defaultParticipantValue ) {
                participantProp.dbValue = defaultParticipantValue.propInternalValue;
                participantProp.uiValue = defaultParticipantValue.propDisplayValue;
            }
        }
        // Reset the valueUpdated to false so that it will make mutiple SOA calls while opening the panel
        // or in case of pinned panel
        participantProp.valueUpdated = false;
        // This check is needed when there is participant type need to be populated then we need to set all
        // values to context service so that if there is any participant eligblity constant set then we need
        // to set correct values in context service so that correct user search will be shown on panel.
        // FIXME
        if( defaultParticipantValue && defaultParticipantValue.propInternalValue ) {
            exports.updateParticipantContextData( defaultParticipantValue.propInternalValue, subPanelContext, assignableParticipantTypes );
        }
    }

    return {
        participantProp : participantProp,
        assignableParticipantTypes : assignableParticipantTypes,
        isValueUpdated : isValueUpdated
    };
};

/**
  * Check if selected participant type is present in multi participant list on context then get
  * all values from that and set it to workflow context and update the user picker panel accordingly.
  *
  * @param {String} participantType Assignable participant type string selected from UI
  * @param {Object} subPanelContext Workflow context object where info need to be stored
  * @param {Array} assignableParticipantTypes Assignable particiapnt types
  * @returns {boolean} True/False to indicate that value is updated or not and based on that
  *          we need to reload the group/role and user data provider.
  */
export let updateParticipantContextData = function( participantType, subPanelContext, assignableParticipantTypes ) {
    var isValueUpdated = false;
    // Check if subPanelContext is not null and it has multiParticipantDataMap info then only we need
    // to update the participant type info on that context so that it can populate other widgets with
    // correct data.
    if( subPanelContext && subPanelContext.multiParticipantDataMap && subPanelContext.multiParticipantDataMap[ participantType ] ) {
        var participantValueObject = subPanelContext.multiParticipantDataMap[ participantType ];


        // Create a copy of subPanelContext values and update all values.
        var localSubPanelContext = { ...subPanelContext.value };
        localSubPanelContext.participantType = participantType;


        if( !localSubPanelContext.criteria ) {
            localSubPanelContext.criteria = {};
        }
        localSubPanelContext.criteria.participantType = participantType;
        localSubPanelContext.criteria.group = '';
        localSubPanelContext.criteria.role = '';

        // Set the selection model mode on content and that will be used to set the selection mode
        // on people picker.
        if( participantValueObject ) {
            var selectionModelMode = participantValueObject.selectModelMode;
            localSubPanelContext.selectionModelMode = selectionModelMode;
        }

        // Check if assignableParticipantTypes is not null then we need to update it on
        // subpanelContext as well and this will be mainly used when panel is pinned and
        // one of participant type user added earlier has been removed from list so we need
        // to update the context object as well to store the correct values.
        if( assignableParticipantTypes ) {
            localSubPanelContext.assignableParticipantTypes = assignableParticipantTypes;
        }

        isValueUpdated = true;
        subPanelContext.update && subPanelContext.update( localSubPanelContext );
    }
    return isValueUpdated;
};

export default exports = {
    populateParticipantTypesData,
    updateParticipantContextData
};

