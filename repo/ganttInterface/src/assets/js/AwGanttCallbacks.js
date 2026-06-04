// Copyright (c) 2022 Siemens
/* eslint-disable class-methods-use-this */

import awGanttStackedService from 'js/AwGanttStackedObjectsService';
import awGanttOverrides from 'js/AwGanttOverrides';

export default class AwGanttCallbacks {
    constructor() {
        this.ganttInstance = undefined; // This should be set by AwGanttChartService.
        this.onBeforeGanttReady = this.onBeforeGanttReady.bind( this );
        this.onGanttReady = this.onGanttReady.bind( this );
        this.onGanttScroll = this.onGanttScroll.bind( this );
        this.onObjectsSelected = this.onObjectsSelected.bind( this );
        this.onBeforeLinkAdd = this.onBeforeLinkAdd.bind( this );
        this.onLinkDblClick = this.onLinkDblClick.bind( this );
        this.onBeforeTaskDrag = this.onBeforeTaskDrag.bind( this );
        this.onAfterTaskDrag = this.onAfterTaskDrag.bind( this );
        this.onTaskOpened = this.onTaskOpened.bind( this );
        this.onTaskClick = this.onTaskClick.bind( this );
        this.onClickToZoom = this.onClickToZoom.bind( this );
    }

    setGanttInstance( ganttInstance ) { this.ganttInstance = ganttInstance; }

    onBeforeGanttReady() {
        awGanttOverrides.initOverrideVariables( this.ganttInstance );
    }
    onGanttReady() {}
    onGanttScroll( left, top ) {}
    onObjectsSelected( selectedUids, previousSelectedUids ) {}
    onBeforeLinkAdd( id, link ) {}
    onLinkDblClick( id, e ) {}
    onBeforeTaskDrag( id, mode, e ) {}
    onAfterTaskDrag( id, mode, e ) {}
    onTaskOpened( id ) {}

    onTaskClick( id, event ) {
        //This is workaround to fix the problem in DHTMLX widget (if onTaskClick is listened, onTaskOpened is not triggered)
        if( event.target && event.target.classList.contains( 'gantt_tree_icon' ) ) {
            if( event.target.classList.contains( 'gantt_open' ) ) {
                this.ganttInstance.open( id );
            } else if( event.target.classList.contains( 'gantt_close' ) ) {
                this.ganttInstance.close( id );
            }
            return;
        }
        let ganttTask = this.ganttInstance.getTask( id );
        if( ganttTask && ganttTask.isBubbleCountSupported() && ganttTask.getStackedObjectsUids().length > 1 ) {
            let stackedUids = ganttTask.getStackedObjectsUids().map( uid => {
                if( uid.indexOf( '__' ) > -1 ) {
                    return uid.substring( 0, uid.indexOf( '__' ) );
                }
                return uid;
            } );
            awGanttStackedService.openStackedPopupPanel( stackedUids, this.ganttInstance, id, this.ganttInstance.getTaskNode( id ) );
        }
    }

    onClickToZoom(  ) {
        let nLevels = this.ganttInstance.ext.zoom.getLevels();
        if( nLevels ) {
            let nextLevel = this.ganttInstance.ext.zoom.getCurrentLevel() + 1;
            if( nextLevel === this.ganttInstance.ext.zoom.getLevels().length ) {
                nextLevel = 0;
            }
            this.ganttInstance.ext.zoom.setLevel( nextLevel );
        }
    }
}
