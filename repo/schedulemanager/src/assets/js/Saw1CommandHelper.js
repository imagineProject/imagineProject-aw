// Copyright (c) 2022 Siemens

/**
 * @module js/Saw1CommandHelper
 */
import commandPanelService from 'js/commandPanel.service';
import appCtxService from 'js/appCtxService';
import soaService from 'soa/kernel/soaService';
import smConstants from 'js/ScheduleManagerConstants';
import AwPromiseService from 'js/awPromiseService';
import userListService  from 'js/userListService';

var exports = {};

/**
 * Method for invoking and registering/unregistering data for the Add Deliverable command panel
 *
 * @param {String} commandId - Command Id for the Add Deliverable command
 * @param {String} location - Location of the Add Deliverable command
 */
export let addDeliverablePanel = function( commandId, location ) {
    var scheduleTask = 'scheduleTask';

    var selection = appCtxService.ctx.selected;

    if( selection ) {
        var props = selection.props;
        if( props ) {
            var taskType = props.task_type.dbValues[ '0' ];
            if( taskType !== smConstants.TASK_TYPE.T && taskType !== smConstants.TASK_TYPE.M &&
                taskType !== smConstants.TASK_TYPE.G ) {
                throw 'deliverableTaskTypeError';
            }

            var scheduleObj = {
                selectedObject: selection
            };
            appCtxService.registerCtx( scheduleTask, scheduleObj );
        }
    } else {
        appCtxService.unRegisterCtx( scheduleTask );
    }
    commandPanelService.activateCommandPanel( commandId, location, undefined, undefined, false );
};


/**
 * Perform the paste behavior for the IModelObjects from schedulemanager/paste.json onto the given 'target'
 * IModelObject creating the given relationship type between them.
 *
 * @param {Object} targetObject - The 'target' IModelObject for the paste.
 * @param {Array} sourceObjects - Array of 'source' IModelObjects to paste onto the 'target' IModelObject
 * @param {String} relationType - relation type name (object set property name)
 * @returns {Promise} The Promise for createRelations SOA
 *
 */
export let deliverablePasteHandler = function( targetObject, sourceObjects, relationType ) {
    var relationTypeToUse = relationType;

    var inputData = {
        input: [ {
            primaryObject: targetObject,
            secondaryObject: sourceObjects[ 0 ],
            relationType: relationTypeToUse
        } ]
    };

    return soaService.post( 'Core-2006-03-DataManagement', 'createRelations', inputData );
};


//check for Schedule Task
export let checkScheduleTask = function( ctx ) {
       
    for( var index = 0; index < ctx.awClipBoardProvider.length; index++ ) {
        if( ctx.awClipBoardProvider[ index ].modelType.typeHierarchyArray.indexOf( 'ScheduleTask' ) <= -1 ) 
        { 
            //other than Schedule task then return false
            return 'errMsgForScheduleTask';
        }
    }
};

exports = {
    addDeliverablePanel,
    deliverablePasteHandler,
    checkScheduleTask
};

export default exports;
