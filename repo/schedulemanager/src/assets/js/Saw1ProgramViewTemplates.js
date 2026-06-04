// Copyright (c) 2022 Siemens

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

export const getTaskClass = ( ganttTask, ganttInstance ) => {
    ganttTask.textColor = '#1e1e1e';
    let taskClasses = [];

    taskClasses.push( ganttTask.getCssClass() );


    if( ganttInstance.isSelectedTask( ganttTask.id ) ) {
        taskClasses.push( 'gantt_selected' );
    }

    return taskClasses.join( ' ' );
};

export const getTooltipText = ( start, end, ganttTask, ganttInstance ) => {
    return ganttTask.getTooltipText && ganttTask.getTooltipText( start, end, ganttTask, ganttInstance );
};

export const getTaskText = ( start, end, ganttTask, ganttInstance ) => {
    return ganttTask.getTaskText && ganttTask.getTaskText( start, end, ganttTask, ganttInstance );
};


export default {
    getGridIconTemplate,
    getTaskClass,
    getTooltipText,
    getTaskText

};
