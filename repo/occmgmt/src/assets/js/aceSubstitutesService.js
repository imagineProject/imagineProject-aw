// Copyright (c) 2022 Siemens

/**
 * An utility that manages Substitutes related processing<br>
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/aceSubstitutesService
 */
import ClipboardService from 'js/clipboardService';
import soaSvc from 'soa/kernel/soaService';
import localeService from 'js/localeService';
import messagingService from 'js/messagingService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import cdm from 'soa/kernel/clientDataModel';
import addElementSvc from 'js/aceAddElementService';
import uwPropertyService from 'js/uwPropertyService';

var exports = {};

export let processAddSubstitutesInput = function( data, sourceObjects ) {
    var substitute = {};
    var substitutes = [];
    var substitutesToBeAdded = [];
    if ( typeof data.createdMainObject === 'undefined' || data.createdMainObject === null ) {
        for ( var i = 0; i < sourceObjects.length; i++ ) {
            substitute = {};
            substitute.type = sourceObjects[i].type;
            substitute.uid = sourceObjects[i].uid;

            substitutesToBeAdded.push( substitute );
            substitutes.push( sourceObjects[i] );
        }
    } else {
        substitute = {};
        substitute.type = data.createdMainObject.type;
        substitute.uid = data.createdMainObject.uid;

        substitutesToBeAdded.push( substitute );
        substitutes.push( data.createdMainObject );
    }
    return { substitutes,  substitutesToBeAdded };
};

export let removeSubstitutes = function( selectedObject, arrOfSubstitutes ) {
    ClipboardService.instance.setContents( arrOfSubstitutes );

    var selectedSubstitutes = [];
    for ( var i = 0; i < arrOfSubstitutes.length; i++ ) {
        var substitute = {};
        substitute.type = arrOfSubstitutes[i].type;
        substitute.uid = arrOfSubstitutes[i].uid;

        selectedSubstitutes.push( substitute );
    }
    var soaInput = {};
    soaInput.inputData = {};
    soaInput.inputData.element = {};
    soaInput.inputData.element.uid = selectedObject.uid;
    soaInput.inputData.element.type = selectedObject.type;
    soaInput.inputData.substitutesToBeRemoved = selectedSubstitutes;
    soaSvc.postUnchecked( 'Internal-ActiveWorkspaceBom-2018-05-OccurrenceManagement', 'removeSubstitutes',
        soaInput ).then( function( response ) {
        if ( response.plain ) {
            var eventData = {};
            eventData.refreshLocationFlag = true;
            eventData.relations = '';
            eventData.relatedModified = [];
            eventData.relatedModified[0] = selectedObject;
            eventBus.publish( 'cdm.relatedModified', eventData );
        }

        if ( response.partialErrors ) {
            var msg = exports.processPartialErrors( response );

            var resource = 'OccurrenceManagementMessages';
            var localeTextBundle = localeService.getLoadedText( resource );
            var errorMessage = msg;
            if ( arrOfSubstitutes.length !== 1 && response.plain ) {
                errorMessage = localeTextBundle.removeSubstituteMultipleFailureMessage;
                errorMessage = errorMessage.replace( '{0}', response.plain.length );
                errorMessage = errorMessage.replace( '{1}', arrOfSubstitutes.length );
                errorMessage = errorMessage.replace( '{2}', msg );
            }
            messagingService.showError( errorMessage );
        }
        eventBus.publish( 'reloadsubstituteGroupTable' );        
    } );
};

var getMessageString = function( messages, msgObj ) {
    _.forEach( messages, function( object ) {
        if ( msgObj.msg.length > 0 ) {
            msgObj.msg += '<BR/>';
        }
        msgObj.msg += object.message;
        msgObj.level = _.max( [ msgObj.level, object.level ] );
    } );
};

export let processPartialErrors = function( serviceData ) {
    var msgObj = {
        msg: '',
        level: 0
    };
    if ( serviceData.partialErrors ) {
        _.forEach( serviceData.partialErrors, function( partialError ) {
            getMessageString( partialError.errorValues, msgObj );
        } );
    }

    return msgObj.msg;
};

export let showListOfSubstitutes = function( vmoHovered, data ) {
    if ( vmoHovered && vmoHovered.props.awb0HasSubstitues ) {
        var substitutesData = {
            substituteObjects : []
        };

        var substituteList = vmoHovered.props.awb0HasSubstitues.displayValues;
        var subArray = [];
        subArray = substituteList[0].split( ',#NL#' );
        //Populate tooltip objects
        var objectsToPush = [];
        for ( var i = 0; i < ( subArray.length > 4 ? 4 : subArray.length ); i++ ) {
            var sub = uwPropertyService.createViewModelProperty( subArray[i], subArray[i], 'STRING', '', '' );
            substitutesData.substituteObjects.push( sub );
        }

        //  Update tooltip label with number of overridden contexts
        var substitutesLabel = data.i18n.substitutesLabel;
        substitutesLabel = substitutesLabel.replace( '{0}', subArray.length );
        substitutesData.substitutesLabel = {};
        substitutesData.substitutesLabel = uwPropertyService.createViewModelProperty( substitutesLabel, substitutesLabel, 'STRING', '', [ '' ] );

        //update tooltip link for more data
        if ( subArray.length > 4 ) {
            var tooltipText = data.i18n.tooltipLinkText;
            tooltipText = tooltipText.replace( '{0}', subArray.length - 4 );
            substitutesData.moreSubstitutes = {};
            substitutesData.moreSubstitutes = uwPropertyService.createViewModelProperty( tooltipText, tooltipText, 'STRING', tooltipText, [ tooltipText ] );
            substitutesData.enableMoreSubstitutes = {};
            substitutesData.enableMoreSubstitutes.dbValue = true;
        }
        return substitutesData;
    }
};

export let getSelectedItem = function( response, pwaSelection ) {
    if( pwaSelection ) {
        var rev = cdm.getObject( pwaSelection.props.awb0Archetype.dbValues[ 0 ] );
        return response.modelObjects[rev.props.items_tag.dbValues[0]];
    }
};

export let extractAllowedTypesInfoFromResponse = function( response ) {
    return addElementSvc.extractAllowedTypesInfoFromResponse( response );
};

export default exports = {
    processAddSubstitutesInput,
    removeSubstitutes,
    processPartialErrors,
    showListOfSubstitutes,
    getSelectedItem,
    extractAllowedTypesInfoFromResponse
};
