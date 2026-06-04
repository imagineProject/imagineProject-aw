// Copyright (c) 2022 Siemens

/**
 * This is the command handler for remove object from cell list.
 *
 * @module js/removePrivilegedUserCommandHandler
 */
import eventBus from 'js/eventBus';

var exports = {};

/**
 * Set command context for remove object cell command which evaluates isVisible and isEnabled flags
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
 * The command context should be setup before calling isVisible, isEnabled and execute.
 *
 */
export let execute = function() {
    eventBus.publish( 'RemovePrivileged.removeUser' );
};

export let removePrivilegedUser = function( data ) {
    if( data.dataProviders ) {
        let emptyResource = [];
        //Update data provider.
        data.dataProviders.getAssignedPrivilegedUser.update( emptyResource );
    }
};

export default exports = {
    setCommandContext,
    execute,
    removePrivilegedUser
};
