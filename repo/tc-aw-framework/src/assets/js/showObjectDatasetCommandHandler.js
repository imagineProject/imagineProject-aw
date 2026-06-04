// Copyright (c) 2020 Siemens

/**
 * This is the command handler service for show object 'Dataset' command which is contributed to cell list.
 *
 * @module js/showObjectDatasetCommandHandler
 */
import commandsMapSvc from 'js/commandsMapService';
import adapterSvc from 'js/adapterService';
import AwStateService from 'js/awStateService';

var exports = {};

/**
 * Set command context for show object dataset cell command which evaluates isVisible and isEnabled flags
 *
 * @param {ViewModelObject} context - Context for the command used in evaluating isVisible, isEnabled and during
 *            execution.
 * @param {Object} $scope - scope object in which isVisible and isEnabled flags needs to be set.
 */
function _setCommandContextIn( context, $scope ) {
    $scope.cellCommandVisiblilty = commandsMapSvc.isInstanceOf( 'Dataset', context.modelType );
}

/**
 * Internal function to execute the command.
 * <P>
 * The command context should be setup before calling isVisible, isEnabled and execute.
 *
 * @param {ViewModelObject} vmo - Context for the command used in evaluating isVisible, isEnabled and during
 *            execution.
 * @param {Object} dataCtxNode - scope object in which isVisible and isEnabled flags needs to be set.
 * @param {Boolean} openInEditMode - Flag to indicate whether to open in edit mode.
 */
function _executeAction( vmo, dataCtxNode, openInEditMode ) {
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

/**
 * Set command context for show object dataset cell command which evaluates isVisible and isEnabled flags
 *
 * @param {ViewModelObject} context - Context for the command used in evaluating isVisible, isEnabled and during
 *            execution.
 * @param {Object} $scope - scope object in which isVisible and isEnabled flags needs to be set.
 */
export let setCommandContext = function( context, $scope ) {
    if( context.type === 'Awp0XRTObjectSetRow' ) {
        var adaptedObjsPromise = adapterSvc.getAdaptedObjects( [ $scope.vmo ] );
        adaptedObjsPromise.then( function( adaptedObjs ) {
            _setCommandContextIn( adaptedObjs[ 0 ], $scope );
        } );
    } else {
        _setCommandContextIn( context, $scope );
    }
};

/**
 * Execute the command.
 * <P>
 * The command context should be setup before calling isVisible, isEnabled and execute.
 *
 * @param {ViewModelObject} vmo - Context for the command used in evaluating isVisible, isEnabled and during
 *            execution.
 * @param {Object} dataCtxNode - scope object in which isVisible and isEnabled flags needs to be set.
 * @param {Boolean} openInEditMode - Flag to indicate whether to open in edit mode.
 */
export let execute = function( vmo, dataCtxNode, openInEditMode ) {
    if( vmo.type === 'Awp0XRTObjectSetRow' ) {
        var adaptedObjsPromise = adapterSvc.getAdaptedObjects( [ vmo ] );
        adaptedObjsPromise.then( function( adaptedObjs ) {
            _executeAction( adaptedObjs[ 0 ], dataCtxNode, openInEditMode );
        } );
    } else {
        _executeAction( vmo, dataCtxNode, openInEditMode );
    }
};

exports = {
    setCommandContext,
    execute
};
export default exports;
