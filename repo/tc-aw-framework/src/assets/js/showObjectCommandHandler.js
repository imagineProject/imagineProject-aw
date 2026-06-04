// Copyright (c) 2021 Siemens

/**
 * @module js/showObjectCommandHandler
 */
import eventBus from 'js/eventBus';

import cdm from 'soa/kernel/clientDataModel';
import commandSvc from 'js/command.service';
import AwStateService from 'js/awStateService';

/**
 * Set command context for show object cell command which evaluates isVisible and isEnabled flags.
 *
 * @param {ViewModelObject} context - Context for the command used in evaluating isVisible, isEnabled and during
 *            execution.
 * @param {Object} $scope - scope object in which isVisible and isEnabled flags needs to be set.
 */
export let setCommandContext = function( context, $scope ) {
    $scope.cellCommandVisiblilty = true;
};

/**
 * Execute the command.
 * <P>
 * The command context should be setup before calling isVisible, isEnabled and execute. Mark the object as read
 * before executing the command.
 *
 * @param {ViewModelObject} vmo - Context for the command used in evaluating isVisible, isEnabled and during
 *            execution.
 * @param {Object} dataCtxNode - scope object in which isVisible and isEnabled flags needs to be set.
 * @param {Boolean} openInEditMode - Flag to indicate whether to open in edit mode.
 */
export let execute = function( vmo, dataCtxNode, openInEditMode ) {
    if( vmo && vmo.uid ) {
        if( !openInEditMode ) {
            var modelObject = cdm.getObject( vmo.uid );

            var commandContext = {
                vmo: modelObject || vmo, // vmo needed for gwt commands
                edit: false
            };

            commandSvc.executeCommand( 'Awp0ShowObjectCell', null, null, commandContext );
        } else {
            if( vmo && vmo.uid ) {
                var showObject = 'com_siemens_splm_clientfx_tcui_xrt_showObject';
                var toParams = {};
                var options = {};

                toParams.uid = vmo.uid;
                if( openInEditMode ) {
                    toParams.edit = 'true';
                }
                options.inherit = false;

                AwStateService.instance.go( showObject, toParams, options );
            }
        }
    }
    eventBus.publish( 'AwAdvanceListExample.openObject', { scope: dataCtxNode } );
};

/**
 * Show object command handler service which sets the visibility of the command in cell list.
 *
 * @member showMessageObjectCommandHandler
 */
const exports = {
    setCommandContext,
    execute
};
export default exports;
