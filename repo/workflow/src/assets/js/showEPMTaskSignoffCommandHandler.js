// Copyright (c) 2022 Siemens

/**
 * This is the command handler for show object command which is contributed to cell list.
 *
 * @module js/showEPMTaskSignoffCommandHandler
 */
import commandsMapSvc from 'js/commandsMapService';
import awInboxService from 'js/aw.inbox.service';
import cdm from 'soa/kernel/clientDataModel';
import soaSvc from 'soa/kernel/soaService';
import msgSvc from 'js/messagingService';
import appCtxSvc from 'js/appCtxService';
import AwStateService from 'js/awStateService';

var exports = {};

/**
 * Set command context for show object cell command which evaluates isVisible and isEnabled flags. This command is
 * valid only when user selects EPMTask or Signoff object.
 *
 * @param {ViewModelObject} context - Context for the command used in evaluating isVisible, isEnabled and during
 *            execution.
 * @param {Object} $scope - scope object in which isVisible and isEnabled flags needs to be set.
 */
export let setCommandContext = function( context, $scope ) {
    // Check for selection type is EPMTask or Signoff
    if( commandsMapSvc.isInstanceOf( 'EPMTask', context.modelType ) ||
        commandsMapSvc.isInstanceOf( 'Signoff', context.modelType ) ) {
        $scope.cellCommandVisiblilty = true;
    } else {
        $scope.cellCommandVisiblilty = false;
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
export let execute = function( vmo, dataCtxNode ) {
    if( vmo && vmo.uid ) {
        //Mark the task as read
        awInboxService.setViewedByMeIfNeeded( vmo );

        if( isSWITask( vmo ) ) {
            return;
        }
        var showObject = 'com_siemens_splm_clientfx_tcui_xrt_showObject';
        var toParams = {};
        var options = {};

        toParams.uid = vmo.uid;
        options.inherit = false;

        AwStateService.instance.go( showObject, toParams, options );
    }
};

/**
 * If task is of SWI open SWI.
 */
function isSWITask( taskObj ) {
    var validEPMTask = awInboxService.getValidEPMTaskObject( taskObj.uid );
    if( validEPMTask ) {
        var jobObject = validEPMTask.props.project_task_attachments;
        if( jobObject ) {
            var job = cdm.getObject( jobObject.dbValues[ 0 ] );
            if( job && job.modelType.typeHierarchyArray.indexOf( 'SSS0JobActivity' ) > -1 ) {
                var ctx = appCtxSvc.ctx;
                if( ctx.hasOwnProperty( 'swiLicense' ) ) {
                    if( ctx.swiLicense === true ) {
                        AwStateService.instance.go( 'com_siemens_splm_client_swi_swiSubLocation', {
                            taskUID: taskObj.uid,
                            jobUID: job.uid
                        }, {} );
                    } else {
                        msgSvc.showError( ctx.swiLicenseErrorMessage );
                    }
                } else {
                    var request = {
                        featureKey: 'mro_swi_viewer',
                        action: 'check'
                    };
                    soaSvc.post( 'Core-2008-03-Session', 'connect', request ).then( function( response ) {
                        var licensePresent = response.outputVal > 0;
                        appCtxSvc.registerCtx( 'swiLicense', licensePresent );
                        if( licensePresent ) {
                            AwStateService.instance.go( 'com_siemens_splm_client_swi_swiSubLocation', {
                                taskUID: taskObj.uid,
                                jobUID: job.uid
                            }, {} );
                        }
                    }, function( data ) {
                        appCtxSvc.registerCtx( 'swiLicense', false );
                        appCtxSvc.registerCtx( 'swiLicenseErrorMessage', data.message );
                        msgSvc.showError( data.message );
                    } );
                }
                return true;
            }
        }
    }
    return false;
}

export default exports = {
    setCommandContext,
    execute
};
