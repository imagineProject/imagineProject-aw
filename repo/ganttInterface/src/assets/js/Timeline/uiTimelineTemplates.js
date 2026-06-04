// Copyright (c) 2022 Siemens

/**
 * @module js/Timeline/uiTimelineTemplates
 */
import appCtx from 'js/appCtxService';
import dateTimeSvc from 'js/dateTimeService';
import timelineManager from 'js/uiGanttManager';
import iconSvc from 'js/iconService';
import _ from 'lodash';

var exports = {};

var iconObjectArray = [ {
    pageId: 'tc_xrt_Deliverables',
    icon: 'gantt_tooltip_deliverables_icon'
},
{
    pageId: 'tc_xrt_Changes',
    icon: 'gantt_tooltip_changes_icon'
},
{
    pageId: 'tc_xrt_eventSchedules',
    icon: 'gantt_tooltip_schedules_icon'
},
{
    pageId: 'tc_xrt_Risks',
    icon: 'gantt_tooltip_risks_icon'
},
{
    pageId: 'tc_xrt_Issues',
    icon: 'gantt_tooltip_issues_icon'
},
{
    pageId: 'tc_xrt_Opportunities',
    icon: 'gantt_tooltip_opportunities_icon'
},
{
    pageId: 'tc_xrt_Criteria',
    icon: 'gantt_tooltip_criteria_icon'
},
{
    pageId: 'tc_xrt_Checklists',
    icon: 'gantt_tooltip_checklist_icon'
}
];

/**
 * Method for adding the template functions.
 *
 */
export let addTemplates = function() {
    //-------------------------------------------------------------------------------------------------------------
    timelineManager.getGanttInstance().templates.grid_folder = function( item ) {
        var icon = {};
        if( typeof item.objectType !== typeof undefined ) {
            var icon = iconSvc.getTypeIconURL( item.objectType );
        } else {
            var programIcon = iconSvc.getTypeIconURL( 'Prg0ProgramPlan' );
            var projectAndSubProjectIcon = iconSvc.getTypeIconURL( 'Prg0ProjectPlan' );
            // Since the Prject and SubProject are of same type hence, keeping the icons same.
            if( item.programType === 0 ) {
                icon = programIcon;
            } else if( item.programType === 1 ) {
                icon = projectAndSubProjectIcon;
            }
        }

        return '<div class=\'gantt_tree_icon\' style=\'background-image:url(' + icon + '\')></div>';
    };
    //-------------------------------------------------------------------------------------------------------------
    timelineManager.getGanttInstance().templates.grid_file = function( item ) {
        var icon = {};
        if( typeof item.objectType !== typeof undefined ) {
            var icon = iconSvc.getTypeIconURL( item.objectType );
        } else {
            var programIcon = iconSvc.getTypeIconURL( 'Prg0ProgramPlan' );
            var projectAndSubProjectIcon = iconSvc.getTypeIconURL( 'Prg0ProjectPlan' );
            // Since the Prject and SubProject are of same type hence, keeping the icons same.
            if( item.programType === 0 ) {
                icon = programIcon;
            } else if( item.programType === 1 ) {
                icon = projectAndSubProjectIcon;
            }
        }

        return '<div class=\'gantt_tree_icon\' style=\'background-image:url(' + icon + '\')></div>';
    };
    //-------------------------------------------------------------------------------------------------------------
    timelineManager.getGanttInstance().date.quarter_start = function( date ) {
        timelineManager.getGanttInstance().date.month_start( date );
        var m = date.getMonth();
        var res_month;

        if( m >= 9 ) {
            res_month = 9;
        } else if( m >= 6 ) {
            res_month = 6;
        } else if( m >= 3 ) {
            res_month = 3;
        } else {
            res_month = 0;
        }

        date.setMonth( res_month );
        return date;
    };
    //-------------------------------------------------------------------------------------------------------------
    timelineManager.getGanttInstance().date.add_quarter = function( date, inc ) {
        return timelineManager.getGanttInstance().date.add( date, inc * 3, 'month' );
    };
    //-------------------------------------------------------------------------------------------------------------
    function quarterLabel( date ) {
        var month = date.getMonth();
        var q_num;

        if( month >= 9 ) {
            q_num = 4;
        } else if( month >= 6 ) {
            q_num = 3;
        } else if( month >= 3 ) {
            q_num = 2;
        } else {
            q_num = 1;
        }
        return 'Q' + q_num;
    }
    //-------------------------------------------------------------------------------------------------------------
    timelineManager.getGanttInstance().config.subscales = [ {
        unit: 'quarter',
        step: 1,
        template: quarterLabel
    }, {
        unit: 'month',
        step: 1,
        date: '%M'
    } ];

    //-------------------------------------------------------------------------------------------------------------
    timelineManager.getGanttInstance().templates.rightside_text = function( start, end, task ) {
        let returnVal = '';
        let stackVal = '';
        let rightText;
        let property = '';

        let preference = appCtx.ctx.preferences.PP_Event_Information;
        if( preference && preference[ 1 ] ) {
            rightText = preference[ 1 ];
        }
        if( task.objectType === 'ScheduleTask' ) {
            property = '<div class="gantt_task_text">' + task.text + '</div>';
        } else if( rightText && task[ rightText ] && task[ rightText ].value !== undefined && task[ rightText ].value !== null ) {
            if( task[ rightText ].isDate ) {
                if( rightText !== 'prg0PlannedDate' || timelineManager.getGanttInstance().config.scale_unit !== 'day' ) {
                    var dateObj = new Date( task[ rightText ].value );
                    var date = dateTimeSvc.formatNonStandardDate( dateObj, 'yyyy-MM-dd' );
                    property = '<div class="gantt_task_date">' + dateTimeSvc.formatDate( date ) + '</div>';
                }
            } else {
                property = '<div class="gantt_task_text">' + task[ rightText ].value + '</div>';
            }
        }

        //Case 1:If Event Information is On and Event Search is not done.
        if( appCtx.ctx.showEventProperties === true && !appCtx.ctx.populateEventData && task.showRight ) {
            returnVal = property;
        }
        //Case 2:Event is searched OR Event is searched with Event Information switched ON
        else if( appCtx.ctx.timelineSearchBy === 'Event' && ( appCtx.ctx.populateEventData || appCtx.ctx.populateEventData && appCtx.ctx.showEventProperties === true ) ) {
            if( appCtx.ctx.populateEventData.dataProvider ) {
                //Case2.1: Event is selected from search result and it matches the current task
                if( appCtx.ctx.populateEventData.dataProvider.selectedObjects.length === 1 &&
                    task.id === appCtx.ctx.populateEventData.dataProvider.selectedObjects[ 0 ].uid ) {
                    if( appCtx.ctx.showEventProperties === true ) {
                        //Event information is on , highlight with a different colour for Event selected from search result
                        returnVal = '<div class="gantt_highlight_selected_task_text gantt_task_text">' + task.text + '</div>';
                    } else {
                        //Event information is OFF, but labels need to be shown for Event selected from search result
                        returnVal = '<div class="gantt_highlight_selected_task_text">' + task.text + '</div>';
                    }
                }
                //Case2.2: For rest of search result, use different colour to highlight the search result
                else if( _.indexOf( appCtx.ctx.populateEventData.searchResults, task.id ) !== -1 &&
                    appCtx.ctx.populateEventData.dataProvider.selectedObjects.length === 1 &&
                    task.id !== appCtx.ctx.populateEventData.dataProvider.selectedObjects[ 0 ].uid ) {
                    if( appCtx.ctx.showEventProperties === true ) {
                        //Event information is on , highlight with a different colour for Events in search result
                        returnVal = '<div class="gantt_highlight_task_text gantt_task_text">' + task.text + '</div>';
                    } else {
                        //Event information is OFF, but labels need to be shown for Events in search result
                        returnVal = '<div class="gantt_highlight_task_text">' + task.text + '</div>';
                    }
                }
                //Case2.3: When Event Information is ON and the events are not part of the search result
                else if( appCtx.ctx.showEventProperties === true &&
                    _.indexOf( appCtx.ctx.populateEventData.searchResults, task.id ) === -1 ) {
                    returnVal = property;
                }
            }
        }
        let stackTimelineObjCountMap;
        if( task.objectType === 'ScheduleTask' ) {
            stackTimelineObjCountMap = appCtx.ctx.popupContext.stackMilestoneCountMap;
        } else {
            stackTimelineObjCountMap = appCtx.ctx.popupContext.stackEventCountMap;
        }
        for( const [ parentPlanUid, eventInfo ] of stackTimelineObjCountMap.entries() ) {
            for( let [ eventUid, stackCount ] of eventInfo.entries() ) {
                if( task.objectType === 'ScheduleTask' ) {
                    eventUid += '__' + parentPlanUid;
                }
                if( task.id === eventUid ) {
                    var className = '';
                    if( returnVal !== '' && appCtx.ctx.layout === 'comfy' ) {
                        className = 'gantt_task_stackedWithInfo'; //for comfortable view with event info/find on
                    } else if( returnVal === '' && appCtx.ctx.layout === 'comfy' ) {
                        className = 'gantt_task_stackedWithoutInfo'; //for comfortable view with event info/find off
                    } else if( returnVal !== '' && appCtx.ctx.layout === 'compact' && returnVal === property ) {
                        className = 'gantt_task_stackedWithInfoCompact'; //for compact view with event info on and find off
                    } else if( returnVal === '' && appCtx.ctx.layout === 'compact' ) {
                        className = 'gantt_task_stackedWithoutInfoCompact'; //for compact view with event info off and find off
                    } else if( returnVal !== '' && appCtx.ctx.layout === 'compact' && returnVal !== property ) {
                        className = 'gantt_task_stackedWithInfoCompactAndFind'; //for compact view with event info on and find on
                    }
                    if( task.objectType === 'ScheduleTask' ) {
                        className += ' gantt_scheduleTask';
                    }
                    stackVal = '<div class="' + className + '"><div class="gantt_task_stackedCount">' + stackCount.length +
                        '</div>';
                }
            }
        }
        returnVal += stackVal;
        return returnVal;
    };
    //-------------------------------------------------------------------------------------------------------------
    timelineManager.getGanttInstance().templates.leftside_text = function( start, end, task ) {
        let returnVal = '';
        let leftText;

        if( appCtx.ctx.showEventProperties === true && task.showLeft ) {
            if( task.objectType === 'ScheduleTask' && timelineManager.getGanttInstance().config.scale_unit !== 'day' ) {
                let PlannedDateObj = new Date( task.plannedDate );
                let milestonePlannedDate = dateTimeSvc.formatNonStandardDate( PlannedDateObj, 'yyyy-MM-dd' );
                returnVal = '<div class="gantt_task_date">' + dateTimeSvc.formatDate( milestonePlannedDate ) + '</div>';
            } else {
                let preference = appCtx.ctx.preferences.PP_Event_Information;
                if( preference && preference[ 0 ] ) {
                    leftText = preference[ 0 ];
                }
                if( leftText && task[ leftText ] && task[ leftText ].value !== undefined && task[ leftText ].value !== null ) {
                    if( task[ leftText ].isDate ) {
                        if( leftText !== 'prg0PlannedDate' || timelineManager.getGanttInstance().config.scale_unit !== 'day' ) {
                            var dateObj = new Date( task[ leftText ].value );
                            var date = dateTimeSvc.formatNonStandardDate( dateObj, 'yyyy-MM-dd' );
                            returnVal = '<div class="gantt_task_date">' + dateTimeSvc.formatDate( date ) + '</div>';
                        }
                    } else {
                        returnVal = '<div class="gantt_task_text">' + task[ leftText ].value + '</div>';
                    }
                }
            }
        }
        return returnVal;
    };
    //-------------------------------------------------------------------------------------------------------------
    timelineManager.getGanttInstance().templates.grid_open = function( item ) {
        if( item.programType === 'SubProject' ) {
            return '<div class=\'gantt_tree_icon gantt_blank\'></div>';
        }
        return '<div class=\'gantt_tree_icon gantt_' + ( item.$open ? 'close' : 'open' ) + '\'></div>';
    };
    //-------------------------------------------------------------------------------------------------------------
    timelineManager.getGanttInstance().templates.tooltip_text = function( start, end, task ) {
        var dateText = timelineManager.getGanttInstance().locale.labels.timeline_label_plannedDate;
        var divElement = '<div class="gantt_tooltip_text"><table><tr>';
        if( task.programType === 'Event' ) {
            var icon = '<div class=\'gantt_tooltip_open_icon\' task_id=' + task.id + '></div>';
            var nameString = '';
            if( typeof task.eventCode !== 'undefined' && task.eventCode !== null ) {
                nameString = nameString + task.eventCode + ' - ';
            }

            if( nameString ) {
                divElement = divElement + '<td><strong>' + nameString + ' ' + '</strong></td>';
            }

            divElement = divElement + '<td class="gantt-task-tooltipText"><strong>' + task.text + '</strong></td><td><strong>' + ' - ' + task.status +
                '</strong></td><td>' + icon + '</td></tr></table>' + '<table class="gantt-tooltip-table">';

            let toolTipProperties = appCtx.ctx.preferences.PP_Event_Tooltip_Information;
            let labels = appCtx.ctx.timelineContext.propertyNames;
            let length = toolTipProperties.length < 3 ? toolTipProperties.length : 3;
            if( toolTipProperties ) {
                if( task.objectType === 'ScheduleTask' ) {
                    divElement = divElement + '<tr><td><strong>' + dateText + ':</strong></td><td>' + timelineManager.getGanttInstance().templates.tooltip_date_format( start ) + '</td></tr>';
                } else {
                    for( let i = 0; i < length; i++ ) {
                        if( task[ toolTipProperties[ i ] ] && task[ toolTipProperties[ i ] ].value !== undefined && task[ toolTipProperties[ i ] ].value !== null ) {
                            divElement = divElement + '<tr><td><strong>' + labels[ toolTipProperties[ i ] ] + ':</strong></td><td>' + task[ toolTipProperties[ i ] ].value + '</td></tr>';
                        }
                    }
                }
            }
            divElement += '</table></div>';
        } else {
            divElement += '<table><tr><td class="gantt-task-tooltipText"><strong>' + task.text + '</strong></td><td><strong>' + ' - ' + task.state +
                '</strong></td></tr></table></div>';
        }

        return divElement;
    };
    //-------------------------------------------------------------------------------------------------------------
    timelineManager.getGanttInstance().templates.task_class = function( start, end, task ) {
        var task_classes = [];
        if( task && task.objectType === 'ScheduleTask' ) { // Milestone
            task_classes.push( 'milestone' );
        } else {
            task_classes.push( 'event' );
        }
        return task_classes.join( ' ' );
    };
    //-------------------------------------------------------------------------------------------------------------
    timelineManager.getGanttInstance().templates.link_class = function( link ) {
        var link_classes = [];

        if( timelineManager.getSelectedLink() === link.id ) {
            link_classes.push( 'selected_link' );
        }

        return link_classes.join( ' ' );
    };
};

export default exports = {
    addTemplates
};
