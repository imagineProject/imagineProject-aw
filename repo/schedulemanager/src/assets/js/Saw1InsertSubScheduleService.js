// Copyright (c) 2022 Siemens

/**
 * @module js/Saw1InsertSubScheduleService
 */
import app from 'app';
import appCtxService from 'js/appCtxService';
import commandPanelService from 'js/commandPanel.service';
import localeSvc from 'js/localeService';
import messagingService from 'js/messagingService';
import selectionService from 'js/selection.service';
import smConstants from 'js/ScheduleManagerConstants';

var exports = {};

/**
 * Fills and returns the container for insert sub-schedule SOA
 *
 * @param {object} masterSchTask - Master schedule task
 * @param {object} masterSch - Master schedule
 * @param {object} data - Data of ViewModelObject
 * @return {array} array of input for insertSchedule SOA
 */
export let getInsertContainer = function( masterSchTask, masterSch, data, sourceObjects ) {
    var input = [];
    var inputData;
    var isSame = false;

    if( masterSchTask !== null && masterSchTask.props.task_type.dbValues[ 0 ] === smConstants.TASK_TYPE.SS ) {
        masterSchTask = null;
    }

    for( var secondObj in sourceObjects ) {
        const schToInsert = sourceObjects[ secondObj ];
        if( schToInsert.uid === masterSch.uid ) {
            isSame = true;
            break;
        }
        if( schToInsert.props.schedule_type.dbValues[ 0 ] === smConstants.SCHEDULE_TYPE.SUB ||
            schToInsert.props.schedule_type.dbValues[ 0 ] === smConstants.SCHEDULE_TYPE.MS ) {
            let sourceModule = 'ScheduleManagerMessages';
            let localTextBundle = localeSvc.getLoadedText( sourceModule );
            let finalMessage = messagingService.applyMessageParamsWithoutContext( localTextBundle.schedulePresentInOtherMaster, [ schToInsert ] );
            messagingService.showError( finalMessage );
            throw 'schedulePresentInOtherMaster';
        }
        if( sourceObjects.hasOwnProperty( secondObj ) ) {
            inputData = {
                subSchedule: schToInsert,
                masterSchedule: masterSch,
                masterScheduleTask: masterSchTask,
                adjustMasterDates: true
            };
            input.push( inputData );
        }
    }
    if( isSame ) {
        throw 'sameSubScheduleErrorMsg';
    }
    return input;
};

/**
 * Activates insert sub schedule panel
 *
 * @param {string} commandId - Id of command
 * @param {string} location - Location of command
 */
export let getInsertSubSchedulePanel = function( commandId, location, commandContext ) {
    var Object = 'object';
    const { dialogAction } = commandContext;
    var selection = selectionService.getSelection().selected;
    if( selection && selection.length > 0 ) {
        var parent = selectionService.getSelection().parent;
        var valueJso;
        if( parent.props.fnd0SummaryTask.dbValues[ 0 ] === selection[ 0 ].props.fnd0ParentTask.dbValues[ 0 ] || selection[ 0 ].props.task_type.dbValues[ 0 ] === smConstants.TASK_TYPE.SS ) {
            valueJso = {
                masterScheduleTask: selection[ 0 ],
                masterSchedule: parent
            };
        } else {
            valueJso = {
                masterScheduleTask: null,
                masterSchedule: parent
            };
        }

        appCtxService.registerCtx( Object, valueJso );
        if( valueJso.masterScheduleTask !== null ) {
            if( dialogAction ) {
                let options =  {
                    view: commandId,
                    parent: '.aw-layout-workarea',
                    placement: 'right',
                    width: 'SMALL',
                    height: 'FULL',
                    isCloseVisible: false,
                    push: true,
                    subPanelContext: commandContext,
                    commandid: commandId,
                    commandicon: 'cmdInsert'
                };
                dialogAction.show( options );
            } else {
                commandPanelService.activateCommandPanel( commandId, location );
            }
        }
    } else {
        appCtxService.unRegisterCtx( Object );
    }
};

exports = {
    getInsertContainer,
    getInsertSubSchedulePanel
};

export default exports;
