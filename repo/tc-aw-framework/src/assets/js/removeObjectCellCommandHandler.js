// Copyright (c) 2020 Siemens

/**
 * This is the command handler for remove object from cell list.
 *
 * @module js/removeObjectCellCommandHandler
 */

var exports = {};

/**
 * Execute the command.
 * <P>
 * The command context should be setup before calling execute.
 *
 * @param {ViewModelObject} vmo - The object that is being removed from the selected projects.
 * @param {Object} commandContext - Contains the atomicData context for selected projects
 */
export let execute = function( vmo, commandContext ) {
    if( commandContext.context && commandContext.context.selectedProjects ) {
        let newContextState = { ...commandContext.context.value };
        newContextState.selectedProjects = newContextState.selectedProjects.filter( function( project ) { return project.uid !== vmo.uid; } );
        newContextState.triggerRemove = true;
        commandContext.context.update( newContextState );
    }
};

exports = {
    execute
};
export default exports;
