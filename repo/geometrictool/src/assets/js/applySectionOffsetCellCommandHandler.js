// Copyright (c) 2022 Siemens

/**
 * This is the command handler for apply section offset value in viewer
 *
 * @module js/applySectionOffsetCellCommandHandler
 */
var exports = {};

/**
 * Set command context for remove object cell command which evaluates isVisible and isEnabled flags
 *
 * @param {ViewModelObject} context - Context for the command used in evaluating isVisible, isEnabled and during
 *            execution.
 * @param {Object} $scope - scope object in which isVisible and isEnabled flags needs to be set.
 */
export let setCommandContext = function( context, $scope ) {
    $scope.$evalAsync( function() {
        $scope.cellCommandVisiblilty = false;
    } );
    $scope.vmo.applySectionCommandScope = $scope;
};

/**
 * Execute the command.
 */
export let execute = function() {
    //Do Nothing
};

export default exports = {
    setCommandContext,
    execute
};
