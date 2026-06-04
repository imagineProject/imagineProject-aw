// Copyright (c) 2022 Siemens

/**
 * @module js/Awp0ReplaceMultipleParticipants
 */
import cdm from 'soa/kernel/clientDataModel';
import messagingSvc from 'js/messagingService';
import listBoxService from 'js/listBoxService';
import appCtxSvc from 'js/appCtxService';
import cmm from 'soa/kernel/clientMetaModel';
import soaService from 'soa/kernel/soaService';
import dmSvc from 'soa/dataManagementService';
import _ from 'lodash';
import eventBus from 'js/eventBus';

/**
 * Define public API
 */
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
 * Populate the Participant property on the panel.
 *
 * @param {object} data - the data Object
 * @param {object} selectedObjects - the current selected objects
 * @param {Obejct} participantProp Participant type property object
 *
 * @returns {Object} Updated particiapnt type prop along with all participant info
 *
 */
var _populateParticipantTypesInternal = function( data, selectedObjects, participantProp ) {
    var participantTypesList = null;
    var localCommonParticipantTypes = null;

    var firstSelection = cdm.getObject( selectedObjects[ 0 ].uid );

    // Get the assignable particiapnt types from first selected object and then use it to iterate for
    // all others objects and find out the common intersection participant types.
    if( firstSelection && firstSelection.props && firstSelection.props.assignable_participant_types ) {
        localCommonParticipantTypes = firstSelection.props.assignable_participant_types.dbValues;
    }

    _.forEach( selectedObjects, function( selection ) {
        var object = cdm.getObject( selection.uid );
        if( object && object.props && object.props.assignable_participant_types &&
            object.props.assignable_participant_types.dbValues ) {
            var participantTypes = object.props.assignable_participant_types.dbValues;
            if( participantTypes ) {
                localCommonParticipantTypes = _.intersection( localCommonParticipantTypes, participantTypes );
            }
        }
    } );

    var commonParticipantTypes = [];
    var commonDispTypeNames = [];

    _.forEach( localCommonParticipantTypes, function( typeName ) {
        var type = cmm.extractTypeNameFromUID( typeName );
        var participantObject = cdm.getObject( typeName );
        if( type && participantObject && participantObject.props.object_string ) {
            var typeDispName = participantObject.props.object_string.uiValues[ 0 ];
            var object = {};
            object.key = typeDispName;
            commonDispTypeNames.push( type );
            object.value = [ type ];
            commonParticipantTypes.push( object );
        }
    } );

    var allObject = {};
    allObject.key = data.i18n.All;
    allObject.value = commonDispTypeNames;

    commonParticipantTypes.splice( 0, 0, allObject );
    var participantListModelArray = [];

    // Check if the common partcipant types are not null and have some element then
    // iterate for each element to create the list model object
    if( commonParticipantTypes.length > 0 ) {
        // Iterate for each object object
        _.forEach( commonParticipantTypes, function( participant ) {
            var listModelObject = _getEmptyListModel();

            listModelObject.propDisplayValue = participant.key;

            listModelObject.propInternalValue = participant.value;
            participantListModelArray.push( participant.key );
        } );
    }

    // Assign the participant types list that will be shown on UI
    participantTypesList = listBoxService.createListModelObjectsFromStrings( participantListModelArray );
    const localParticipantProp = { ...participantProp };
    if( participantTypesList && !_.isEmpty( participantTypesList ) && participantTypesList[ 0 ] ) {
        localParticipantProp.dbValue = participantTypesList[ 0 ].propInternalValue;
        localParticipantProp.uiValue = participantTypesList[ 0 ].propDisplayValue;
    }
    return {
        participantTypes: participantTypesList,
        commonParticipantTypes : commonParticipantTypes,
        participantProp : localParticipantProp,
        selectedObjects : selectedObjects
    };
};

/**
 * Populate the Participant property on the panel.
 *
 * @param {object} data - the data Object
 * @param {object} selectedObjects - the current selected objects
 * @param {Obejct} participantProp Participant type property object
 *
 * @returns {Object} Updated particiapnt type prop along with all participant info
 *
 */
export let populateParticipantTypes = function( data, selectedObjects, participantProp ) {
    // Check if selected objects is not valid or empty then no need to process further
    // and return from here.
    if( !selectedObjects || _.isEmpty( selectedObjects ) ) {
        return {
            selectedObjects : selectedObjects,
            commonParticipantTypes : [],
            participantTypes : [],
            participantProp : participantProp
        };
    }

    var allObjectUid = [];
    for( var i = 0; i < selectedObjects.length; ++i ) {
        allObjectUid.push( selectedObjects[ i ].uid );
    }

    // Get the assignable_participant_types property for all selected objects and then populate the
    // common participant types.
    return dmSvc.getProperties( allObjectUid, [ 'assignable_participant_types' ] ).then( function() {
        return _populateParticipantTypesInternal( data, selectedObjects, participantProp );
    } );
};

/**
 * Get the particiapnt internal types that user is trying to add.
 *
 * @param {String} selectedType Selected participant type string
 * @param {Array} commonParticipantTypes Common participant type array that hold internal and display values
 * @returns {Array} Participant types that user is trying to add
 */
export let getParticipantTypes = function( selectedType, commonParticipantTypes ) {
    var values = [];

    if( selectedType && commonParticipantTypes ) {
        for( var idx = 0; idx < commonParticipantTypes.length; idx++ ) {
            var participant = commonParticipantTypes[ idx ];
            if( participant && participant.key === selectedType ) {
                values = participant.value;
                break;
            }
        }
    }
    return values;
};

/**
 * Get the error message string based on input object
 *
 * @param {Object} input - SOA response
 * @returns {String} Error message string
 */
var getErrorMessageString = function( input ) {
    var message = '';
    var err = null;
    // Check if input response is not null and contains partial errors then only
    // create the error object
    if( input && ( input.partialErrors || input.PartialErrors ) ) {
        err = soaService.createError( input );
    }

    // Check if error object is not null and has partial errors then iterate for each error code
    // and filter out the errors which we don't want to display to user
    if( err && err.cause && err.cause.partialErrors ) {
        _.forEach( err.cause.partialErrors, function( partErr ) {
            if( partErr.errorValues ) {
                _.forEach( partErr.errorValues, function( errVal ) {
                    if( errVal.code ) {
                        if( message && message.length > 0 ) {
                            message += '\n' + errVal.message;
                        } else {
                            message += errVal.message + '\n';
                        }
                    }
                } );
            }
        } );
    }
    return message;
};

/**
 * Populate the error message based on the SOA response output and filters the partial errors and shows the correct
 * errors only to the user.
 *
 * @param {data} data - declarative view modal
 * @param {selections} selections - selected objects
 * @param {input} input - SOA response
 */
export let generateNotificationsToUser = function( data, selections, input ) {
    var message = '';
    var updatedModelObjects = [];
    var selectedObjs = [];
    var isReloadNeeded = false;
    var updatedObjectsCount = 0;
    var failedCount = 0;

    updatedModelObjects = input.updated;

    _.forEach( selections, function( selection ) {
        selectedObjs.push( selection.uid );
    } );
    if( updatedModelObjects ) {
        var updatedSelectedObjs = _.intersection( updatedModelObjects, selectedObjs );

        // Check if updated objects is not null and not empty then we set the isReloadNeeded
        // flag to true and this flag will be used to reset the change location.
        if( updatedSelectedObjs && updatedSelectedObjs.length > 0 ) {
            updatedObjectsCount = updatedSelectedObjs.length;
            isReloadNeeded = true;
        }

        // Check if only one object is updated then we need to show single success message.
        if( updatedObjectsCount === 1 && updatedSelectedObjs && updatedSelectedObjs.length > 0 ) {
            data.updatedSelObjsname = cdm.getObject( updatedSelectedObjs[ 0 ] ).props.object_string;
            message += data.i18n.oneSelectedSuccess;

            messagingSvc.reportNotyMessage( data, data._internal.messages, 'oneSelectedSuccess' );
        }
    }

    // Get te failed item revisions that could not update
    if( data.output.reassignParticipantOutput && data.output.reassignParticipantOutput.failedItemRevs ) {
        var failedObjs = data.output.reassignParticipantOutput.failedItemRevs;

        if( failedObjs && failedObjs.length > 0 ) {
            failedCount = failedObjs.length;
        }
    }

    // Check if only one object is failed to updated then we need to show single failure message.
    if( failedCount === 1 ) {
        data.failedSelObjsname = cdm.getObject( failedObjs[ 0 ] ).props.object_string;
        message += data.i18n.oneSelectedFailure;

        messagingSvc.reportNotyMessage( data, data._internal.messages, 'oneSelectedFailure' );
    }
    // In case of more that 1 success and failure then show the correct success and failure message.
    if(  updatedObjectsCount > 1  ||  failedCount > 1  ) {
        if( updatedObjectsCount > 1 ) {
            data.updatedCount = updatedObjectsCount;
            data.selectedCount = selections.length;
            messagingSvc.reportNotyMessage( data, data._internal.messages, 'moreThanOneSuccess' );
        }

        // Get the error message string from SOA output structure
        message = getErrorMessageString( input );

        if( message && message.length > 0 ) {
            messagingSvc.showError( message );
        }
    }

    // Close Panel
    eventBus.publish( 'complete', { source: 'toolAndInfoPanel' } );

    // Check if boolean value is true that means reassign action got completed successfully. SO if sub location is change location
    // then we should reload the location to see correct set of results. Fix for defect # D-31013.
    if( isReloadNeeded ) {
        var locationContext = appCtxSvc.getCtx( 'locationContext.ActiveWorkspace:Location' );

        if( locationContext && locationContext === 'com.siemens.splm.client.change:changesLocation' ) {
            //Reload the primary work area data
            eventBus.publish( 'primaryWorkarea.reset' );
        }
    }
};

/**
 * Update the specific provider based on input selected users.
 * @param {Array} selectedUsers Selected user array that need to be added
 * @param {String} contextProp Property string value that will be fromUser or toUser.
 * @param {Object} dataProvider Dataprovider object that need to be updated with selected users
 * @returns {Array} Selected users that will be shown in from or to section
 */
export let updateDataProvider = function( selectedUsers, contextProp, dataProvider ) {
    let users = selectedUsers;
    if( dataProvider && users  ) {
        // Check if user obejct is not null and 0th index object is valid then
        // set the propName on that object and that will be used while removing it from
        // specific section
        if( users[ 0 ] && users[ 0 ].uid && contextProp ) {
            users[ 0 ].propName = contextProp;
        }

        //update data provider
        dataProvider.update( users, users.length );

        //clear selection
        dataProvider.selectNone();
    }
    return users;
};

export default exports = {
    populateParticipantTypes,
    getParticipantTypes,
    generateNotificationsToUser,
    updateDataProvider
};
