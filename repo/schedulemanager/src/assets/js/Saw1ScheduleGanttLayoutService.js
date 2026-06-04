// Copyright (c) 2022 Siemens

import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import awGanttConfigService from 'js/AwGanttConfigurationService';
import eventBus from 'js/eventBus';

//  Defines the map of number of baselines to gantt bar height for 'compact' and 'comfy' modes.
const ganttBarHeight = {
    compact: { 0: 'full', 1: 10, 2: 18 },
    comfy: { 0: 'full', 1: 10, 2: 18 }
};

const getComputedGanttRowHeight = ( nBaselines ) => {
    let sampleRowEl = document.querySelectorAll( '#scheduleNavigationTree .aw-splm-tablePinnedContainer .aw-splm-tableRow' )[ 0 ];

    // Get computed border bottom width as it changes with browser zoom level.
    let borderBottomWidth = sampleRowEl ? parseFloat( window.getComputedStyle( sampleRowEl ).getPropertyValue( 'border-bottom-width' ) ) : awGanttConfigService.TABLE_ROW_BORDER_BOTTOM_WIDTH;

    // Get row height based on number of baselines
    let getRowHeight = ( nBaselines ) => {
        return awGanttConfigService.getDefaultRowHeight() + ( nBaselines > 1 ? appCtxSvc.ctx.layout === 'compact' ? 32 : 24 : 0 );
    };

    return getRowHeight( nBaselines ) + borderBottomWidth;
};

export const updateTableRowHeight = ( scheduleTree, scheduleNavigationContext ) => {
    let isGanttChartOn = _.get( appCtxSvc.getCtx( 'preferences.AW_SubLocation_ScheduleNavigationSubLocation_ShowGanttChart' ), '0', 'true' ) !== 'false';
    let nBaselines = scheduleNavigationContext.getValue().baselineUids.length;

    // Get row height based on number of baselines
    let rowHeight = isGanttChartOn && nBaselines > 1 ? 'LARGE' : awGanttConfigService.getDefaultRowHeight();

    if( scheduleTree.gridOptions.rowHeight !== rowHeight ) {
        scheduleTree.gridOptions.rowHeight = rowHeight;
        eventBus.publish( 'scheduleNavigationTree.plTable.clientRefresh' );
    }
};

export const updateGanttRowHeight = ( atomicDataRef ) => {
    const ganttInstance = atomicDataRef.ganttChartState.getAtomicData().ganttInstance;
    if( ganttInstance ) {
        resetGanttRowHeight( ganttInstance );
    }
};

const resetGanttRowHeight = ( ganttInstance ) => {
    if( ganttInstance ) {
        let rowHeight = getComputedGanttRowHeight( ganttInstance.baselineUids.length );
        let barHeight = _.get( ganttBarHeight, [ appCtxSvc.ctx.layout, ganttInstance.baselineUids.length ], 0 );

        if( ganttInstance.config.row_height !== rowHeight || ganttInstance.config.bar_height !== barHeight ) {
            ganttInstance.config.row_height = rowHeight;
            ganttInstance.config.bar_height = barHeight;
            ganttInstance.render();
        }
    }
};

export const debounceResetGanttRowHeight = _.debounce( ( ganttInstance ) => {
    resetGanttRowHeight( ganttInstance );
}, 500 );

export default {
    updateTableRowHeight,
    updateGanttRowHeight,
    debounceResetGanttRowHeight
};
