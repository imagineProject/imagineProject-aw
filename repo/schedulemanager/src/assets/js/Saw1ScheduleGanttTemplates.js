// Copyright (c) 2022 Siemens

import appCtxSvc from 'js/appCtxService';
import awIconService from 'js/awIconService';
import cdm from 'soa/kernel/clientDataModel';

export const getGridIconTemplate = ( ganttTask ) => {
    let tcObject = cdm.getObject( ganttTask.uid );
    let icon = awIconService.getTypeIconFileUrl( tcObject );
    return '<div class=\'gantt_tree_icon\' style=\'background-image:url(' + icon + '\')></div>';
};

export const getGridRowClass = ( start, end, ganttTask, ganttInstance ) => {
    if( ganttInstance.isSelectedTask( ganttTask.id ) ) {
        return 'gantt_selected';
    }
};

export const getTaskClass = ( start, end, ganttTask, ganttInstance ) => {
    ganttTask.textColor = '#1e1e1e';
    let taskClasses = [];

    if( ganttInstance.baselineUids.length > 0 ) {
        taskClasses.push( ganttInstance.baselineUids.length >= 2 ? 'has_baseline2' : appCtxSvc.ctx.layout === 'compact' ? 'has_baseline_compact' : 'has_baseline_comfy' );
    }

    taskClasses.push( ganttInstance.isCriticalTask( ganttTask ) ? 'gantt_critical_task' : ganttTask.getCssClass() );

    if( !ganttTask.canDragStart() ) {
        taskClasses.push( 'gantt_hide_start_drag' );
    }

    if( !ganttTask.canDragEnd() ) {
        taskClasses.push( 'gantt_hide_finish_drag' );
    }

    if( !ganttTask.canDragProgress() ) {
        taskClasses.push( 'gantt_hide_progress_drag' );
    }

    if( ganttInstance.isSelectedTask( ganttTask.id ) ) {
        taskClasses.push( 'gantt_selected' );
    }

    return taskClasses.join( ' ' );
};

export const getLinkClass = ( link, ganttInstance ) => {
    var linkClasses = [];
    if( ganttInstance.isCriticalLink( link ) ) {
        linkClasses.push( 'gantt_critical_link' );
    }

    if( ganttInstance.baselineUids.length > 0 ) {
        linkClasses.push( ganttInstance.baselineUids.length >= 2 ? 'has_baseline2' : appCtxSvc.ctx.layout === 'compact' ? 'has_baseline_compact' : 'has_baseline_comfy' );
    }

    if( ganttInstance.selectedLink === link.id ) {
        linkClasses.push( 'selected_link' );
    }

    return linkClasses.join( ' ' );
};

export const getTooltipText = ( start, end, ganttTask, ganttInstance ) => {
    return ganttTask.getTooltipText && ganttTask.getTooltipText( start, end, ganttTask, ganttInstance );
};

export const getTaskText = ( start, end, ganttTask, ganttInstance ) => {
    return ganttTask.getTaskText && ganttTask.getTaskText( start, end, ganttTask, ganttInstance );
};

export const getLeftSideText = ( start, end, ganttTask, ganttInstance ) => {
    return ganttTask.getLeftSideText && ganttTask.getLeftSideText( start, end, ganttTask, ganttInstance );
};

export const getRightSideText = ( start, end, ganttTask, ganttInstance ) => {
    return ganttTask.getRightSideText && ganttTask.getRightSideText( start, end, ganttTask, ganttInstance );
};

export const getTimelineCellClass = ( ganttTask, date, ganttInstance ) => {
    if( ganttInstance.isCurrentZoomLevel( 'day' ) && !ganttInstance.isWorkTime( date ) ) {
        return 'week_end';
    }
    return '';
};

export default {
    getGridIconTemplate,
    getGridRowClass,
    getTaskClass,
    getLinkClass,
    getTooltipText,
    getTaskText,
    getLeftSideText,
    getRightSideText,
    getTimelineCellClass
};
