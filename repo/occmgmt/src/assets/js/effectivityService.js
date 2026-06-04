// Copyright (c) 2022 Siemens

/**
 * @module js/effectivityService
 */
import awMessageService from 'js/messagingService';
import eventBus from 'js/eventBus';
import _ from 'lodash';

var _eventSubDefs = [];
var exports = {};

export let initialize = function() {
    _eventSubDefs.push( eventBus.subscribe( 'addElement.elementsAdded', function( event ) {
        if( !_.isUndefined( event.addElementResponse ) && event.addElementResponse.partialErrors ) {
            event.addElementResponse.partialErrors.forEach( function( partialError ) {
                partialError.errorValues.forEach( function( errorValue ) {
                    if( errorValue.code === 26025 || errorValue.code === 26026 ) {
                        let messageText = errorValue.message;
                        awMessageService.showError( messageText );
                    }
                } );
            } );
        }
    } ) );
};


export let destroy = function() {
    _.forEach( _eventSubDefs, function( subDef ) {
        eventBus.unsubscribe( subDef );
    } );
};

export default exports = {
    initialize,
    destroy
};

