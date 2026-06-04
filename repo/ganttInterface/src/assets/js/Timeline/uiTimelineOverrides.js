//@<COPYRIGHT>@
//==================================================
//Copyright 2017.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/*global
 define
 console
 */

/**
 * @module js/Timeline/uiTimelineOverrides
 */
import timelineManager from 'js/uiGanttManager';

var exports = {};

// /**
//  * Method for adding the overrides.
//  */
export let addOverrides = function( timelineDataSource ) {
    timelineManager.getGanttInstance().$data.tasksStore._isSplitItem = ( task ) => {
        return 'split' === task.render;
    };
    timelineManager.getGanttInstance().isLinkAllowed = ( from, fromStart, to, toStart ) => {
        if( from.source && from.target ) {
            return timelineDataSource.checkDuplicateDependency( from.source, from.target );
        }
    };
};

export default exports = {
    addOverrides
};
