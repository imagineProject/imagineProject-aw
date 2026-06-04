// Copyright (c) 2022 Siemens

import awGanttStackedService from 'js/AwGanttStackedObjectsService';

export const initOverrideVariables = ( ganttInstance ) => {
    ganttInstance.recalculateStackedObjInfo = ( ganttTaskUids ) => {
        let parentChildMap = awGanttStackedService.getParentChildMap( ganttTaskUids, ganttInstance, false );
        updateStackedCount( parentChildMap, ganttInstance );
    };

    ganttInstance.recalculateStackedObjInfoForParent = ( parentTaskUids ) => {
        let parentChildMap = awGanttStackedService.getParentChildMapForParent( parentTaskUids, ganttInstance, false );
        updateStackedCount( parentChildMap, ganttInstance );
    };

    ganttInstance.$data.tasksStore.calculateItemLevel = ( item ) => {
        var level = 1;
        ganttInstance.eachParent( function() {
            level++;
        }, item );
        return level;
    };

    ganttInstance.isCurrentZoomLevel = ( levelName ) => {
        let currentZoomLevel = ganttInstance.ext.zoom.getLevels()[ ganttInstance.ext.zoom.getCurrentLevel() ];
        return currentZoomLevel.name === levelName;
    };
};

const updateStackedCount = ( parentChildMap, ganttInstance ) => {
    for( let parent in parentChildMap ) {
        let childObjects = parentChildMap[ parent ];
        awGanttStackedService.calculateAndUpdateOffset( childObjects, ganttInstance );
        awGanttStackedService.updateStackedCount( childObjects, ganttInstance );
    }
    ganttInstance.render();
};

export default {
    initOverrideVariables
};
