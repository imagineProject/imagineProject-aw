// Copyright (c) 2022 Siemens

/**
 * @module js/ShiftSchedulePanel
 */
import commandPanelService from 'js/commandPanel.service';
import selectionService from 'js/selection.service';
import appCtxService from 'js/appCtxService';

var exports = {};

export let getShiftSchedulePanel = function( commandId, location, commandContext ) {
    var Scheduletag = 'Scheduletag';
    const { dialogAction } = commandContext;
    var selection = selectionService.getSelection().selected;
    var scheduleObject;
    var flag;
    var endDateSchedulingFlag;
    var nameOfSchedule;
    if( selection && selection.length > 0 ) {
        flag = selection[ 0 ].props.end_date_scheduling.dbValues[ 0 ];
        if( flag === '0' ) {
            endDateSchedulingFlag = false;
        } else {
            endDateSchedulingFlag = true;
        }
        nameOfSchedule = selection[ 0 ].props.object_name.dbValues[ 0 ];
        scheduleObject = {
            selected: selection[ 0 ],
            isEndDateScheduling: endDateSchedulingFlag,
            scheduleName: nameOfSchedule
        };
        appCtxService.registerCtx( Scheduletag, scheduleObject );
    } else {
        appCtxService.unRegisterCtx( Scheduletag );
    }
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
            commandicon: 'cmdShiftDate'
        };
        dialogAction.show( options );
    } else {
        commandPanelService.activateCommandPanel( commandId, location );
    }
};

export default exports = {
    getShiftSchedulePanel
};
