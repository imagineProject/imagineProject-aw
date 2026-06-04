// Copyright (c) 2022 Siemens

/**
 * @module js/Awp0ReplaceMultipleParticipantCommandHandler
 */
import TypeDisplayNameService from 'js/typeDisplayName.service';
import messagingService from 'js/messagingService';
import commandPanelService from 'js/commandPanel.service';
import notyService from 'js/NotyModule';
import _ from 'lodash';

var exports = {};

/**
 * Validate the selection and if slection are not valid then generate the
 * error message and return from here.
 *
 * @param {object} data - data of the context object.
 * @param {objectsArray} selections - selected object list.
 *
 * @return {Object} Final message string that need to be shown to user if needed
 */
var _validateSelectionAndGenerateMessage = function( data, selections ) {
    var popUpMessage = '';
    var validSels = [];
    var inValidSels = [];
    var finalMessage;
    var outputData = {};
    // Check for each selected object and if selected object is not type of Item revision
    // then it will not be valid type so show the error to user
    if( selections ) {
        // Iterate for each object object
        _.forEach( selections, function( selObject ) {
            if( selObject && selObject.modelType.typeHierarchyArray.indexOf( 'ItemRevision' ) === -1 ) {
                var nonApplicableObj = TypeDisplayNameService.instance.getDisplayName( selObject );
                popUpMessage = popUpMessage.concat( messagingService.applyMessageParams( data.i18n.objNotItemRevision1,
                    [ '{{nonApplicableObj}}' ], { nonApplicableObj: nonApplicableObj } ) ).concat( '</br>' );
                inValidSels.push( selObject );
            } else {
                validSels.push( selObject );
            }
        } );

        // Check if valid selection is not null and only one valid selection is present then
        // show the message to user that only one obejct can be reassigend. And in case of multiple
        // invalid selection then show that out of selected objects some objects cannot be reassigend.
        if( validSels.length === 1 && validSels[ 0 ] ) {
            var nonApplicableObj = TypeDisplayNameService.instance.getDisplayName( validSels[ 0 ] );
            finalMessage = popUpMessage.concat( messagingService.applyMessageParams( data.i18n.oneReassignable, [ '{{nonApplicableObj}}' ], { nonApplicableObj: nonApplicableObj } ) ).concat( '</br>' );
        } else if( inValidSels.length >= 1 && popUpMessage.length > 0 ) {
            if( inValidSels.length > 1 ) {
                var canBeReassigend = selections.length - inValidSels.length;
                var totalSelectedObj = selections.length;

                var message = messagingService.applyMessageParams( data.i18n.someReassignable, [ '{{canBeReassigend}}', '{{totalSelectedObj}}' ], {
                    canBeReassigend: canBeReassigend,
                    totalSelectedObj: totalSelectedObj
                } );
                finalMessage = message.concat( '</br>' ).concat( popUpMessage );
            } else {
                finalMessage = popUpMessage;
            }
        }
    }

    outputData = {
        finalMessage: finalMessage,
        validSels: validSels
    };
    return outputData;
};

/**
 * This method will validate the selections and based on that show the message to user or open the panel
 *
 * @param {object} data - data of the context object.
 * @param {object} ctx - context object.
 * @param {objectsArray} selections - selected object list.
 * @param {Object} commandContext - the command context
 */
export let validateAndActivateCommandPanel = function( data, ctx, selections, commandContext ) {
    // Check if command is alrady active then panel should be closed and return from here
    const { dialogAction } = commandContext;
    if(  ctx.activeToolsAndInfoCommand && ctx.activeToolsAndInfoCommand.commandId === 'Awp0ReplaceMultipleParticipants'  ) {
        commandPanelService.activateCommandPanel( 'Awp0ReplaceMultipleParticipants', 'aw_toolsAndInfo' );
        return;
    }

    // Validate the selection and generate message if need to show to user
    var outputData = _validateSelectionAndGenerateMessage( data, selections );

    // Check if final message is not null and empty then only show it to user else open the panel directly
    if( outputData && outputData.finalMessage && outputData.finalMessage.length > 0 ) {
        var buttons = [ {
            addClass: 'btn btn-notify',
            text: data.i18n.CancelText,
            onClick: function( $noty ) {
                $noty.close();
            }
        },
        {
            addClass: 'btn btn-notify',
            text: data.i18n.Proceed,
            onClick: function( $noty ) {
                $noty.close();
                var panelContext = {
                    validObjects : outputData.validSels
                };
                if( dialogAction ) {
                    let options = {
                        view: 'Awp0ReplaceMultipleParticipants',
                        parent: '.aw-layout-workareaMain',
                        placement: 'right',
                        width: 'SMALL',
                        height: 'FULL',
                        push: false,
                        isCloseVisible: false,
                        subPanelContext: { ...commandContext, ...panelContext }
                    };
                    dialogAction.show( options );
                } else {
                    commandPanelService.activateCommandPanel( 'Awp0ReplaceMultipleParticipants', 'aw_toolsAndInfo', panelContext );
                }
            }
        }
        ];
        notyService.showWarning( outputData.finalMessage, buttons );
    } else {
        var panelContext = {
            validObjects : outputData.validSels
        };
        if( dialogAction ) {
            let options = {
                view: 'Awp0ReplaceMultipleParticipants',
                parent: '.aw-layout-workareaMain',
                placement: 'right',
                width: 'SMALL',
                height: 'FULL',
                push: false,
                isCloseVisible: false,
                subPanelContext: { ...commandContext, ...panelContext }
            };
            dialogAction.show( options );
        } else {
            commandPanelService.activateCommandPanel( 'Awp0ReplaceMultipleParticipants', 'aw_toolsAndInfo', panelContext );
        }
    }
};

export default exports = {
    validateAndActivateCommandPanel
};
