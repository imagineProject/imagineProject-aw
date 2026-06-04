// Copyright (c) 2022 Siemens

/**
 * @module js/AssignResourceAndGetReplaceMemberService
 */
import selectionService from 'js/selection.service';
import commandPanelService from 'js/commandPanel.service';
import appCtxService from 'js/appCtxService';
import soa_kernel_clientDataModel from 'soa/kernel/clientDataModel';

var exports = {};

export let getAssignResourcePanel = function( commandId, location, commandContext ) {
    var schedule = 'schedule';
    const { dialogAction } = commandContext;

    var selection = selectionService.getSelection().selected;

    if( selection && selection.length > 0 ) {
        var parent = selectionService.getSelection().parent;

        var scheduleObj = {
            selectedObject: selection,
            scheduleTag: parent
        };

        appCtxService.registerCtx( schedule, scheduleObj );
    } else {
        appCtxService.unRegisterCtx( schedule );
    }

    if( dialogAction ) {
        let options =  {
            view: commandId,
            parent: '.aw-layout-workarea',
            placement: 'right',
            width: 'STANDARD',
            height: 'FULL',
            isCloseVisible: false,
            push: false,
            subPanelContext: commandContext
        };
        dialogAction.show( options );
    } else {
        commandPanelService.activateCommandPanel( commandId, location );
    }
};

export let getReplaceMemberPanel = function( commandId, location, commandContext ) {
    var schedule = 'schedule';
    const { dialogAction } = commandContext;
    var selection = selectionService.getSelection().selected;
    if( selection && selection.length > 0 ) {
        var parent = selectionService.getSelection().parent;
        var jso;
        jso = {
            ScheduleMember: selection[ 0 ],
            selectedObject: parent
        };
        appCtxService.registerCtx( schedule, jso );
    } else {
        appCtxService.unRegisterCtx( schedule );
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
            commandicon: 'cmdChangeOwner'
        };
        dialogAction.show( options );
    } else {
        commandPanelService.activateCommandPanel( commandId, location );
    }
};

export let getDesignateDisciplineToMembersPanel = function( commandId, location, commandContext ) {
    var designateDiscInfo = 'designateDiscInfo';
    const { dialogAction } = commandContext;
    var selection = selectionService.getSelection().selected;
    if( selection && selection.length > 0 ) {
        var parent = selectionService.getSelection().parent;
        var disciplineObj = soa_kernel_clientDataModel.getObject( selection[ 0 ].props.resource_tag.dbValues[ 0 ] );
        let context = {
            disciplineObj: disciplineObj,
            scheduleObj: parent
        };
        if( dialogAction ) {
            let options =  {
                view: commandId,
                parent: '.aw-layout-workarea',
                placement: 'right',
                width: 'SMALL',
                height: 'FULL',
                isCloseVisible: false,
                push: true,
                subPanelContext: context
            };
            dialogAction.show( options );
        } else {
            commandPanelService.activateCommandPanel( commandId, location, context );
        }
    }
};

export let getUser = function() {
    var selection = selectionService.getSelection().selected;
    var userObj;
    if( selection && selection.length > 0 ) {
        userObj = soa_kernel_clientDataModel.getObject( selection[ 0 ].props.resource_tag.dbValues[ 0 ] );
    }
    return userObj;
};

exports = {
    getAssignResourcePanel,
    getReplaceMemberPanel,
    getDesignateDisciplineToMembersPanel,
    getUser
};

export default exports;
