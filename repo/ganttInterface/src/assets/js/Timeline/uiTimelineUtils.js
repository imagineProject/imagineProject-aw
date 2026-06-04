// Copyright (c) 2022 Siemens

/**
 * @module js/Timeline/uiTimelineUtils
 */
import { getBaseUrlPath } from 'app';
import $ from 'jquery';
import eventBus from 'js/eventBus';
import timelineManager from 'js/uiGanttManager';
import timelineEventHandler from 'js/Timeline/uiTimelineEventHandler';
import appCtx from 'js/appCtxService';
import _cdm from 'soa/kernel/clientDataModel';
import cmm from 'soa/kernel/clientMetaModel';
import selectionService from 'js/selection.service';
import preferenceService from 'soa/preferenceService';
import _ from 'lodash';
import dateTimeService from 'js/dateTimeService';
import messagingService from 'js/messagingService';
import ganttUtils from 'js/GanttUtils';
import _cmm from 'soa/kernel/clientMetaModel';
import dmSvc from 'soa/dataManagementService';
import prgTimelinUtils from 'js/Timeline/prgTimelineUtils';
import tableSvc from 'js/splmTablePublishedService';

var exports = {};

let padding = 0;

let getStylingForGanttSideContent = function() {
    const outerLeft = document.createElement( 'div' );
    outerLeft.className = 'gantt_side_content gantt_left';
    outerLeft.style.visibility = 'hidden';
    document.body.appendChild( outerLeft );
    var leftstyling = window.getComputedStyle( outerLeft );

    const outerRight = document.createElement( 'div' );
    outerRight.className = 'gantt_side_content gantt_right';
    outerRight.style.visibility = 'hidden';
    document.body.appendChild( outerRight );
    var rightstyling = window.getComputedStyle( outerRight );

    return parseInt( leftstyling.paddingRight, 10 ) + parseInt( leftstyling.marginRight, 10 ) +
        parseInt( rightstyling.paddingLeft, 10 ) + parseInt( rightstyling.marginLeft, 10 );
};

/**
 *
 * @param {map} planToEventMap - Contains mapping of Parent Plan to its events(ascending order)
 * @param {*} operationType - Set to null , if type of operation is not specified by the caller (Add/Update/Delete)
 */
export let updatePositionsForEventInfo = function( planToEventMap, operationType = null ) {
    //Determines the font-size and font-family to calculate length of text in pixels format
    var element = document.createElement( 'canvas' );
    var context = element.getContext( '2d' );
    var eventFontSize = window.getComputedStyle( document.getElementsByClassName( 'aw-splm-tableCellText' )[ 0 ] ).fontSize;
    var eventFontFamily = window.getComputedStyle( document.getElementsByClassName( 'aw-splm-tableCellText' )[ 0 ] ).fontFamily;

    let width = 20; //milestone width
    if( !padding ) {
        padding = getStylingForGanttSideContent();
    }

    for( const [ key, value ] of planToEventMap.entries() ) {
        let eventsArr = value;
        //If the event is the only event that the parent has , then show both sides information
        if( eventsArr.length === 1 ) {
            let event = ganttUtils.getGanttTask( eventsArr[ 0 ] );
            event.showLeft = true;
            event.showRight = true;
            if( operationType === 'Delete' || operationType === 'Update' || operationType === 'Add' || operationType === 'Zoom' ) {
                timelineManager.getGanttInstance().refreshTask( event.id );
            }
        } else if( eventsArr.length > 1 ) {
            for( let i = 0; i < eventsArr.length; i++ ) {
                let event = ganttUtils.getGanttTask( eventsArr[ i ] );
                let position = ganttUtils.getGanttTaskPosition( event );

                //Default to false
                event.showLeft = false;
                event.showRight = false;
                context.font = eventFontSize + ' ' + eventFontFamily;
                let preference = appCtx.ctx.preferences.PP_Event_Information;
                var leftSize = 2; //Adding buffer
                if( event[ preference[ 0 ] ] !== undefined ) {
                    leftSize += context.measureText( event[ preference[ 0 ] ].value ).width;
                } else if( event.objectType === 'ScheduleTask' ) {
                    leftSize += context.measureText( dateTimeService.formatNonStandardDate( new Date( event.plannedDate ), 'yyyy-MM-dd' ) ).width;
                }
                var rightSize = 2; //Adding buffer
                if( event[ preference[ 1 ] ] !== undefined ) {
                    rightSize += context.measureText( event[ preference[ 1 ] ].value ).width;
                } else {
                    rightSize += context.measureText( event.text ).width;
                }
                let eventIndex = eventsArr.indexOf( event.id );
                let prevIndex = eventIndex - 1;
                let nextIndex = eventIndex + 1;

                //If another event is there before the current event
                if( prevIndex > -1 ) {
                    let prevEvent = eventsArr[ prevIndex ]; //get the prev obj
                    let prevEventObj = ganttUtils.getGanttTask( prevEvent ); //find the prev obj in eventArr to get gantt params
                    let prevEventPos = ganttUtils.getGanttTaskPosition( prevEventObj ); //task position of prev obj

                    let prevEventRightSize = 2; //get the prev event's right side text size and add buffer
                    if( prevEventObj[ preference[ 1 ] ] !== undefined ) {
                        prevEventRightSize += context.measureText( prevEventObj[ preference[ 1 ] ].value ).width;
                    } else if( prevEventObj.objectType === 'ScheduleTask' ) {
                        prevEventRightSize += context.measureText( prevEventObj.text ).width;
                    }

                    let totalDistance = position.left - ( prevEventPos.left + width + padding ); //distance between cur & next event
                    //Case1: Both (previous right and current left ) can fit
                    if( totalDistance >= leftSize + prevEventRightSize ) {
                        event.showLeft = true;
                        prevEventObj.showRight = true;
                    }
                    //Case2 : Only Previous right can fit
                    else if( leftSize > prevEventRightSize && totalDistance >= leftSize ) {
                        event.showLeft = true;
                        prevEventObj.showRight = false;
                    }
                    //Case3: Only current left can fit
                    else if( prevEventRightSize > leftSize && totalDistance >= prevEventRightSize ) {
                        event.showLeft = false;
                        prevEventObj.showRight = true;
                    }
                } else {
                    event.showLeft = true;
                }
                if( nextIndex < eventsArr.length ) {
                    let nextEvent = eventsArr[ nextIndex ]; //get the next obj
                    let nextEventObj = ganttUtils.getGanttTask( nextEvent ); //find the next obj in eventArr to get gantt params
                    let nextEventPos = ganttUtils.getGanttTaskPosition( nextEventObj ); //task position of next obj
                    let nextEventLeftSize = 2; //get the next event's left side text size and adding some buffer
                    if( nextEventObj[ preference[ 0 ] ] !== undefined ) {
                        nextEventLeftSize += context.measureText( nextEventObj[ preference[ 0 ] ].value ).width;
                    } else if( nextEventObj.objectType === 'ScheduleTask' ) {
                        nextEventLeftSize += context.measureText( dateTimeService.formatNonStandardDate( new Date( nextEventObj.plannedDate ), 'yyyy-MM-dd' ) ).width;
                    }
                    let totalDistance = nextEventPos.left - ( position.left + width + padding ); //distance between cur & next event , right = left +width of milestone
                    //Case1: Both (current right and next left ) can fit
                    if( totalDistance >= rightSize + nextEventLeftSize ) {
                        event.showRight = true;
                        nextEventObj.showLeft = true;
                    }
                    //Case2 : Only next left can fit
                    else if( nextEventLeftSize > rightSize && totalDistance >= nextEventLeftSize ) {
                        event.showRight = false;
                        nextEventObj.showLeft = true;
                    }
                    //Case3: Only current right can fit
                    else if( rightSize > nextEventLeftSize && totalDistance >= rightSize ) {
                        event.showRight = true;
                        nextEventObj.showLeft = false;
                    }
                } else {
                    event.showRight = true;
                }
                if( operationType === 'Delete' || operationType === 'Update' || operationType === 'Add' || operationType === 'Zoom' ) {
                    timelineManager.getGanttInstance().refreshTask( event.id );
                }
            }
        }
    }
};

/**
 *
 * @param {array} event - Array containing Events of DHTMLX type
 * @param {object} data - Object containing dataproviders results
 * @param {string} operationType - Set to null , if type of operation is not specified(Add/Update/Delete)
 */
export let setZoomParamForEventPosition = function( parent, data, operationType ) {
    let planObjs = data.dataProviders.planNavigationTreeDataProvider.viewModelCollection.loadedVMObjects;
    let idx = _.findIndex( planObjs, function( planObj ) { return planObj.uid === parent; } );
    let planToEventMap = new Map();
    if( planObjs.length > 0 && idx > -1 ) {
        for( let i = 0; i < planObjs.length; i++ ) {
            var childrenOfPlanObj = ganttUtils.getChildren( planObjs[ i ].uid );
            for( let idx = 0; idx < childrenOfPlanObj.length; idx++ ) {
                let obj = ganttUtils.getGanttTask( childrenOfPlanObj[ idx ] );
                if( obj.type !== 'milestone' ) {
                    childrenOfPlanObj.splice( idx, 1 );
                }
            }
            childrenOfPlanObj.sort( function( a, b ) {
                let aTask = ganttUtils.getGanttTask( a );
                let bTask = ganttUtils.getGanttTask( b );
                return aTask.start_date > bTask.start_date ? 1 : -1;
            } );
            planToEventMap.set( planObjs[ i ].uid, childrenOfPlanObj );
        }
    }
    updatePositionsForEventInfo( planToEventMap, operationType );
};

/**
 *
 * @param {array} event - Array containing Events of DHTMLX type
 * @param {object} data - Object containing dataproviders results
 * @param {string} operationType - Set to null , if type of operation is not specified(Add/Update/Delete)
 */
export let setInputParamForEventPosition = function( events, data, operationType = null ) {
    let planObjs = data.dataProviders.planNavigationTreeDataProvider.viewModelCollection.loadedVMObjects;
    let planToEventMap = new Map();

    events.forEach( function( eveObj ) {
        let parentIndex;
        //Incase of deletion and zoom level changes, parent plan is being sent
        if( operationType === 'Delete' ) {
            parentIndex = _.findIndex( planObjs, function( planObjNode ) { return planObjNode.uid === eveObj; } );
        } else { //For Add and Update , event has parent property
            parentIndex = _.findIndex( planObjs, function( planObjNode ) { return planObjNode.uid === eveObj.parent; } );
        }

        if( parentIndex > -1 ) {
            let planUid = planObjs[ parentIndex ].uid;

            if( !planToEventMap.has( planUid ) ) {
                planToEventMap.set( planUid, [] );
            }
            var childrenOfPlanObj = ganttUtils.getChildren( planUid );
            for( let idx = 0; idx < childrenOfPlanObj.length; idx++ ) {
                let obj = ganttUtils.getGanttTask( childrenOfPlanObj[ idx ] );
                if( obj.type !== 'milestone' ) {
                    childrenOfPlanObj.splice( idx, 1 );
                }
            }
            childrenOfPlanObj.sort( function( a, b ) {
                let aTask = ganttUtils.getGanttTask( a );
                let bTask = ganttUtils.getGanttTask( b );
                return aTask.start_date > bTask.start_date ? 1 : -1;
            } );
            planToEventMap.set( planUid, childrenOfPlanObj );
        }
    } );
    updatePositionsForEventInfo( planToEventMap, operationType );
};

/**
 * Initializes the Timeline by applying the CSS for the default skin, work time and custom style.
 */
export let assureCSSInitialization = function() {
    // This is check for CSS link which is used for Timeline
    // styling .
    var cssCheck = $( 'head:first > link' ).filter(
        '[href=\'' + getBaseUrlPath() + '/lib/dhtmlxgantt/skins/dhtmlxgantt_meadow.css\']' ).length;
    if( cssCheck === 0 ) {
        /**
         * Include the CSS for 'dhxgantt' module.
         */
        var link = document.createElement( 'link' );
        link.type = 'text/css';
        link.rel = 'stylesheet';
        link.href = getBaseUrlPath() + '/lib/dhtmlxgantt/skins/dhtmlxgantt_meadow.css';
        var linkNode = $( 'head:first > link' );
        document.getElementsByTagName( 'head' )[ 0 ].insertBefore( link, linkNode[ 0 ] );
    }
};

//sets the initial configurations correctly
export let initializeConfigurations = function() {
    timelineManager.getGanttInstance().templates.task_text = function( start, end, task ) {
        return '';
    };
    //This will display the name of event in timeline but it will be hidden by css file. This is done to validate the name of event from step def.
    timelineManager.getGanttInstance().templates.leftside_text = function( start, end, task ) {
        return task.text;
    };
    //following configurations should always be in the directive as they are needed to
    //set the initialization correctly.
    timelineManager.getGanttInstance().config.smart_rendering = false;
    timelineManager.getGanttInstance().config.multiselect = true;
    //sets the date format that is used to parse data from the data set.
    timelineManager.getGanttInstance().config.xml_date = '%Y-%m-%d %H:%i';
    timelineManager.getGanttInstance().config.grid_width = 200;
    timelineManager.getGanttInstance().keep_grid_width = true;
    timelineManager.getGanttInstance().config.work_time = true;
    timelineManager.getGanttInstance().config.correct_work_time = false;
    timelineManager.getGanttInstance().config.grid_resize = true;
    timelineManager.getGanttInstance().config.scale_height = 20 * 3;
    timelineManager.getGanttInstance().config.row_height = 30;
    timelineManager.getGanttInstance().config.scale_unit = 'year';
    timelineManager.getGanttInstance().config.date_scale = '%Y';
    timelineManager.getGanttInstance().keyboard_navigation = true;
    timelineManager.getGanttInstance().keyboard_navigation_cells = true;
    timelineManager.getGanttInstance().config.show_links = false;
};

/**
 * Sets the initial Timeline configuration.
 *
 * @param {object} timelineConfig - Configuration for Timeline.
 * @param {String} timelineZoomPreference - the value of preference to set the viewtype
 */
export let setTimelineConfig = function( timelineConfig, timelineZoomPreference, openedObject ) {
    timelineManager.getGanttInstance().config.readonly = timelineConfig.readOnly;
    timelineManager.getGanttInstance().config.order_branch = timelineConfig.orderBranch;
    timelineManager.getGanttInstance().config.drag_move = timelineConfig.dragMove;
    timelineManager.getGanttInstance().config.drag_resize = timelineConfig.dragResize;
    timelineManager.getGanttInstance().config.drag_progress = timelineConfig.dragProgress;
    timelineManager.getGanttInstance().config.drag_links = timelineConfig.dragLinks;
    timelineManager.getGanttInstance().config.details_on_dblclick = timelineConfig.detailsOnDbClick;
    timelineManager.getGanttInstance().config.auto_scheduling = timelineConfig.autoScheduling;
    timelineManager.getGanttInstance().config.auto_scheduling_initial = timelineConfig.autoSchedulingInitial;
    timelineManager.getGanttInstance().config.auto_scheduling_strict = timelineConfig.autoSchedulingStrict;
    timelineManager.getGanttInstance().config.round_dnd_dates = timelineConfig.roundDndDates;
    timelineManager.getGanttInstance().config.fit_tasks = true;
    timelineManager.getGanttInstance().config.show_links = false;
    timelineManager.getGanttInstance().config.show_unscheduled = true;
    //TODO fix with passing the variable as input
    timelineManager.getGanttInstance().config.show_grid = appCtx.ctx.locationContext[ 'ActiveWorkspace:SubLocation' ] !== 'com.siemens.splm.client.prgplanning:PlanNavigationSubLocation';
    //Render dependency link again when user changes sublocation and comes back on timeline
    timelineManager.getGanttInstance().config.show_links = appCtx.ctx.showHideEventDependencyFlag ? appCtx.ctx.showHideEventDependencyFlag : false;
    timelineManager.getGanttInstance().config.drag_links = appCtx.ctx.showHideEventDependencyFlag ? appCtx.ctx.showHideEventDependencyFlag : false;

    let viewType = 'month';

    if( openedObject.props.prg0UnitOfTimeMeasure ) {
        viewType = 'unit_of_time_measure';
    }
    if( timelineZoomPreference ) {
        viewType = timelineZoomPreference;
    }
    setTimelineZoomLevel( viewType, false, openedObject );
};
/**
 *
 *For handling the case when sublocation is changed to honour the selection of viewType
 *Here we have registered timelineZoomLevel to handle the case when a new user logs in and clicks on the command and just changes sublocations without refreshing the timeline.
 * @param {object} data - Data object.
 */
export let updatePreferenceForTimelineZoom = function( data ) {
    var preference = appCtx.getCtx( 'preferences.AWC_Timeline_Zoom_Level' );
    if( preference ) {
        preference[ 0 ] = data.eventData.viewType;
        appCtx.updateCtx( 'preferences.AWC_Timeline_Zoom_Level', preference );
    } else {
        appCtx.registerCtx( 'timelineZoomLevel', data.eventData.viewType );
    }
    eventBus.publish( 'timelineZoomPreferenceUpdated' );
};

/**
 * Method to get scale based on preference(AWC_Timeline_Zoom_Level) value
 * @param scale -Scale to map.
 * @returns mapping for UOM to timeline scale
 */
let getTimelineScaleMapping = function( scale ) {
    switch ( scale ) {
        case 'd':
            return 'year';
        case 'w':
            return 'day';
        case 'mo':
            return 'week';
        case 'q':
            return 'month';
        case 'y':
            return 'quarter';
    }
};

/**
 *Method for mapping the value in unit of time measure preference to the correct scale for stack count
 * @param {string} scale in unit of time measure
 */
export let mappingForUnitOfTimeStackCount = function( scale ) {
    switch ( scale ) {
        case 'd':
            return 'day';
        case 'w':
            return 'week';
        case 'mo':
            return 'month';
        case 'q':
            return 'quarter';
        case 'y':
            return 'year';
    }
};

/**
 *
 * Transformation function for the viewType preference
 * @param {String} viewType -Scale to load timeline.
 * @param {boolean} flag - Flag to decide whether to render the timeline or not.
 */
export let setTimelineZoomLevel = function( viewType, flag, openedObject ) {
    updateStackCountOnZoom( viewType );
    switch ( viewType ) {
        case 'day':
            viewType = 'year';
            break;
        case 'week':
            viewType = 'day';
            break;
        case 'month':
            viewType = 'week';
            break;
        case 'quarter':
            viewType = 'month';
            break;
        case 'year':
            viewType = 'quarter';
            break;
        case 'unit_of_time_measure':
            if( openedObject.props.prg0UnitOfTimeMeasure ) {
                if( openedObject.modelType && openedObject.modelType.typeHierarchyArray.indexOf( 'Prg0AbsPlan' ) > -1 ) {
                    viewType = getTimelineScaleMapping( openedObject.props.prg0UnitOfTimeMeasure.dbValues[ 0 ] );
                } else {
                    viewType = 'week'; //For versions before tc13.2 the default is month view as unit_of_time property is not present there.
                }
            }
            break;
    }
    loadTimelineScale( viewType );
    if( flag ) {
        timelineManager.getGanttInstance().render();
    }
    //Move scrollbar to selected event position on zoom level change
    prgTimelinUtils.scrollToSelectedObject( appCtx.ctx.selected );
};

/**
 *
 * Function to decide the label of the timeline in case of month view
 *this gives the quarter of the current month
 * @param {Date} date - The current date to find the Quarter to be shown on the timeline
 */
export let quarterLabel = function( date ) {
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
};

/**
 * Method to get header height of the gantt.
 * @returns height of the header
 */
let getTimelineHeaderHeight = function() {
    // This is the header height used for tree table.
    return 72;
};

/**
 * Method to get row height of the timeline - based on the display mode.
 * @returns row height of the timeline
 */
let getTimelineRowHeight = function() {
    // Set the row height based on the display mode, similar to splm table.
    let rowHeight = appCtx.ctx.layout === 'compact' ? tableSvc.HEIGHT_COMPACT_ROW : tableSvc.HEIGHT_ROW;
    return rowHeight + 1;
};

/**
 * Method to reset Timeline Parameters
 */
let resetTimelineParameter = function() {
    timelineManager.getGanttInstance().templates.date_scale = '';
};

/**
 * Method to load timeline based on scale.
 *
 * @param viewtype -Scale to load timeline.
 */
export let loadTimelineScale = function( viewType ) {
    resetTimelineParameter();
    switch ( viewType ) {
        case 'year':
            timelineManager.getGanttInstance().config.scale_unit = 'day';
            timelineManager.getGanttInstance().config.step = 1;
            timelineManager.getGanttInstance().config.date_scale = '%d, %D';
            timelineManager.getGanttInstance().config.scale_height = getTimelineHeaderHeight();
            var weekScaleTemplate = function( date ) {
                var weekText = timelineManager.getGanttInstance().locale.labels.weeks;
                var dateToStr = timelineManager.getGanttInstance().date.date_to_str( '%d %m' );
                var weekNum = timelineManager.getGanttInstance().date.date_to_str( '(' + weekText + ' %W)' );
                var endDate = timelineManager.getGanttInstance().date.add( timelineManager.getGanttInstance().date
                    .add( date, 1, 'week' ), -1, 'day' );
                return dateToStr( date ) + ' - ' + dateToStr( endDate ) + ' ' + weekNum( date );
            };
            timelineManager.getGanttInstance().config.subscales = [ {
                unit: 'month',
                step: 1,
                date: '%F, %Y'
            }, {
                unit: 'week',
                step: 1,
                template: weekScaleTemplate
            }

            ];
            timelineManager.getGanttInstance().config.row_height = getTimelineRowHeight();
            timelineManager.getGanttInstance().templates.timeline_cell_class = function( task, date ) {
                if( !timelineManager.getGanttInstance().isWorkTime( date ) ) {
                    return 'week_end';
                }
                return '';
            };
            break;
        case 'day':
            timelineManager.getGanttInstance().config.scale_unit = 'week';
            timelineManager.getGanttInstance().config.step = 1;
            timelineManager.getGanttInstance().config.scale_height = getTimelineHeaderHeight();
            timelineManager.getGanttInstance().config.subscales = [ {
                unit: 'month',
                step: 1,
                date: '%M'
            },
            {
                unit: 'year',
                step: 1,
                date: '%Y'
            }
            ];
            timelineManager.getGanttInstance().config.row_height = getTimelineRowHeight();
            timelineManager.getGanttInstance().templates.timeline_cell_class = function( task, date ) {
                return '';
            };
            var weekScaleTemplate = function( date ) {
                var dateToStr = timelineManager.getGanttInstance().date.date_to_str( '%d' );
                var endDate = timelineManager.getGanttInstance().date.add( timelineManager.getGanttInstance().date
                    .add( date, 1, 'week' ), -1, 'day' );
                var weekNum = timelineManager.getGanttInstance().date.date_to_str( '(%W)' );
                return dateToStr( date ) + '-' + dateToStr( endDate ) + ' ' + weekNum( date );
            };
            timelineManager.getGanttInstance().templates.date_scale = weekScaleTemplate;
            break;
        case 'week':
            timelineManager.getGanttInstance().config.scale_unit = 'month';
            timelineManager.getGanttInstance().config.date_scale = '%M';
            timelineManager.getGanttInstance().config.scale_height = getTimelineHeaderHeight();
            timelineManager.getGanttInstance().config.subscales = [ {
                unit: 'year',
                step: 1,
                date: '%Y'
            },
            {
                unit: 'quarter',
                step: 1,
                template: quarterLabel
            }
            ];
            timelineManager.getGanttInstance().config.row_height = getTimelineRowHeight();
            timelineManager.getGanttInstance().templates.timeline_cell_class = function( task, date ) {
                return '';
            };
            break;
        case 'quarter':
            timelineManager.getGanttInstance().config.scale_unit = 'year';
            timelineManager.getGanttInstance().config.step = 1;
            timelineManager.getGanttInstance().config.date_scale = '%Y';
            timelineManager.getGanttInstance().config.scale_height = getTimelineHeaderHeight();
            timelineManager.getGanttInstance().config.subscales = [];
            timelineManager.getGanttInstance().config.row_height = getTimelineRowHeight();
            timelineManager.getGanttInstance().templates.timeline_cell_class = function( task, date ) {
                return '';
            };
            break;
        case 'month':
            timelineManager.getGanttInstance().config.scale_unit = 'quarter';
            timelineManager.getGanttInstance().templates.date_scale = quarterLabel;
            timelineManager.getGanttInstance().config.scale_height = getTimelineHeaderHeight();
            timelineManager.getGanttInstance().config.subscales = [ {
                unit: 'year',
                step: 1,
                date: '%Y'
            } ];
            timelineManager.getGanttInstance().config.row_height = getTimelineRowHeight();
            timelineManager.getGanttInstance().templates.timeline_cell_class = function( task, date ) {
                return '';
            };
            break;
    }
};

/**
 *
 * Scroll the timeline to selected date in timeline
 * @param {Object} data - Data object
 */
export let goToDate = function( data, isToday ) {
    let date = new Date();
    if( !isToday ) {
        if( data.enterDate ) {
            date = new Date( data.enterDate.dbValue );
        } else {
            date = new Date( data.dbValues[ 0 ] );
        }
    }
    let day = date.getDate();
    let month = date.getMonth();
    let year = date.getFullYear();
    let dateToScroll = new Date( year, month, day );
    let dateToShowInMsg = dateTimeService.formatDate( dateToScroll );
    let dates = timelineManager.getGanttInstance().getSubtaskDates(); //gets program's first event's and last event's date
    let startDateBoundary = new Date( dates.start_date.getFullYear(), dates.start_date.getMonth(), dates.start_date.getDate() );
    let endDateBoundary = new Date( dates.end_date.getFullYear(), dates.end_date.getMonth(), dates.end_date.getDate() );
    //the below lines check whether out of program boundary dates are entered or not
    if( endDateBoundary.getTime() < dateToScroll.getTime() ) {
        let message = data.i18n.Pgp0GoToOutOfBoundAfter;
        let dateLast = dateTimeService.formatDate( dates.end_date );
        let outOfBoundMessage = messagingService.applyMessageParams( message, [ '{{dateToShow}}', '{{dateLast}}' ], {
            dateToShow: dateToShowInMsg,
            dateLast: dateLast
        } );
        messagingService.showInfo( outOfBoundMessage );
    } else if( startDateBoundary.getTime() > dateToScroll.getTime() ) {
        let message = data.i18n.Pgp0GoToOutOfBoundBefore;
        let dateFirst = dateTimeService.formatDate( dates.start_date );
        let outOfBoundMessage = messagingService.applyMessageParams( message, [ '{{dateToShow}}', '{{dateFirst}}' ], {
            dateToShow: dateToShowInMsg,
            dateFirst: dateFirst
        } );
        messagingService.showInfo( outOfBoundMessage );
    }
    //For scrolling
    let position = timelineManager.getGanttInstance().posFromDate( dateToScroll ); //settig the leftmost position of timeline as the date
    timelineManager.getGanttInstance().scrollTo( position ); //scrolling to the position set
};

/**
 * Method to set the default columns in the Timeline.
 *
 * @param {Array} columns -The gantt columns.
 */
export let setDefaultColumns = function( columns ) {
    timelineManager.getGanttInstance().config.columns = columns;
};

/**
 * Method to initialize the locale for the Timeline.
 *
 * @param {Array} date -The date information.
 * @param {Array} labels -The labels information.
 */
export let initLocale = function( date, labels ) {
    timelineManager.setLocalisedValues( date, labels );
    timelineManager.getGanttInstance().locale.date = date;
    timelineManager.getGanttInstance().locale.labels = labels;
};

/**
 * Method is callback from the GWT layer to show plans and events after a pagination request.
 *
 * @param {Array} plansAndEvents - Array of plan and event objects to be rendered in the timeline.
 */
export let showMoreData = function( plansAndEvents ) {
    plansAndEvents.forEach( function( planOrEvent ) {
        timelineManager.getGanttInstance().addTask( planOrEvent, planOrEvent.parent, planOrEvent.id );
    } );
    timelineManager.getGanttInstance().refreshData();
    timelineManager.getGanttInstance().render();
    var endTime = new Date().getTime();
    var startDate = timelineManager.startPaginate;
    var startTime = startDate.getTime();
    var delta = endTime - startTime;
    var total = plansAndEvents.length;
    timelineManager.debugMessage( '10. Total time for loading ' + total + ' objects took ' + delta +
        ' milliseconds' );
};
/**
 * Method is callback from the GWT layer to refresh tasks and links on the time-line after there is an update.
 *
 * @param {Array} timelines - Array of time-line objects to be rendered in the time line.
 * @param {Array} events - Array of event objects to be rendered in the time line.
 */
export let refreshTimeline = function( timelines, events ) {
    var hasUpdate = false;
    if( timelines ) {
        timelines.forEach( function( currentTimeline ) {
            if( timelineManager.getGanttInstance().isTaskExists( currentTimeline.id ) ) {
                var timeline = timelineManager.getGanttInstance().getTask( currentTimeline.id );
                timeline.text = currentTimeline.text;
                timeline.state = currentTimeline.state;
                timelineManager.getGanttInstance().refreshTask( timeline.id );
                hasUpdate = true;
            }
        } );
    }

    if( events ) {
        events.forEach( function( currentEvent ) {
            if( timelineManager.getGanttInstance().isTaskExists( currentEvent.id ) ) {
                var event = timelineManager.getGanttInstance().getTask( currentEvent.id );
                event.text = currentEvent.text;
                event.eventName = currentEvent.text;
                event.object_name = currentEvent.text;
                event.state = currentEvent.state;
                event.status = currentEvent.status;
                event.start_date = new Date( timelineManager.formatDate( currentEvent.start_date ) );
                event.forecastDate = currentEvent.forecastDate;
                event.actualDate = currentEvent.actualDate;
                event.end_date = new Date( timelineManager.formatDate( currentEvent.end_date ) );
                event.color = currentEvent.color;

                let toolTipProperties = appCtx.ctx.preferences.PP_Event_Tooltip_Information;
                if( !toolTipProperties ) {
                    toolTipProperties = [];
                }
                toolTipProperties = toolTipProperties.concat( appCtx.ctx.preferences.PP_Event_Information );
                if( toolTipProperties ) {
                    toolTipProperties.forEach( property => {
                        event[ property ] = currentEvent[ property ];
                    } );
                }

                timelineManager.getGanttInstance().refreshTask( event.id );
                timelineManager.getGanttInstance().showDate( new Date( event.start_date ) );
                hasUpdate = true;
            }
        } );
    }
    if( hasUpdate === true ) {
        timelineManager.getGanttInstance().refreshData();
    }

    timelineEventHandler.updateTodayMarkerHeight();
};

/**
 * Method is callback from the GWT layer to add newly created plans or events on the time-line.
 * @param {Array} plansOrEvents - Array of newly created plan or event objects.
 * @param {Array} links - Array of newly created dependency between events
 *
 */
export let addCreatedObjectsOnTimeline = function( plansOrEvents, links ) {
    var hasUpdate = false;
    let eventsArr = [];
    if( plansOrEvents && plansOrEvents.length > 0 ) {
        plansOrEvents.forEach( function( current ) {
            var prevSiblingIndex = null;
            if( current.programType === 'Event' ) {
                var startDateObject = new Date( timelineManager.formatDate( current.start_date ) );
                var endDateObject = new Date( timelineManager.formatDate( current.end_date ) );

                current.start_date = startDateObject;
                current.end_date = endDateObject;
                //Fill the array to store newly added objects
                eventsArr.push( current );
            }
            if( typeof current.prevID !== 'undefined' ) {
                prevSiblingIndex = timelineManager.getGanttInstance().getTaskIndex( current.prevID );
                timelineManager.getGanttInstance().addTask( current, current.parent, prevSiblingIndex + 1 );
            } else {
                timelineManager.getGanttInstance().addTask( current, current.parent );
            }
            if( current.programType !== 'Event' ) {
                let parentTask = prgTimelinUtils.getTimelineTask( current.parent );
                if( parentTask && parentTask.$open === undefined ) {
                    parentTask.$open = true;
                }
            }
            hasUpdate = true;
        } );
    }
    if( links ) {
        links.forEach( function( currentLink ) {
            if( !timelineManager.getGanttInstance().isLinkExists( currentLink.id ) ) {
                timelineManager.getGanttInstance().addLink( currentLink );
            }
        } );
        hasUpdate = true;
    }
    if( hasUpdate === true ) {
        timelineManager.getGanttInstance().refreshData();
        if( plansOrEvents && plansOrEvents.length > 0 ) {
            timelineEventHandler.updateTodayMarkerHeight();
            eventBus.publish( 'eventsAddedOnTimeline', eventsArr );
            eventBus.publish( 'objectsAddedOnTimeline', plansOrEvents );
        }
    }
};

/**
 * Method is callback from the GWT layer to remove timeline elements from the View.
 *
 * @param {Array} deletedObjects - Array of objects to be removed from the timeline.
 */
export let removeDeletedObjectsOnTimeline = function( deletedObjects ) {
    deletedObjects.forEach( function( deleted ) {
        var taskExists = timelineManager.getGanttInstance().isTaskExists( deleted.id );
        if( taskExists === true ) {
            let task = timelineManager.getGanttInstance().getTask( deleted.id );
            let parentPlan = task.parent;
            timelineManager.getGanttInstance().deleteTask( deleted.id );
            timelineEventHandler.updateTodayMarkerHeight();
            eventBus.publish( 'objectsDeletedFromTimeline', parentPlan );
        }
    } );
};

/**
 * Remove timeline elements
 *
 * @param {Array} deletedUids - Array of uids of objects to be removed from the timeline.
 */
export let removeDeletedObjectsOnTimeline2 = function( deletedUids ) {
    deletedUids.forEach( deletedUid => {
        var taskExists = timelineManager.getGanttInstance().isTaskExists( deletedUid );
        if( taskExists === true ) {
            timelineManager.getGanttInstance().deleteTask( deletedUid );
            timelineEventHandler.updateTodayMarkerHeight();
        }
    } );
    return deletedUids.includes( appCtx.ctx.timelineContext.selected.uid );
};

/**
 * Method for getting the global task index. used in populating the rowNumber column.
 *
 * @param {Object} task - the task object.
 */
export let getGlobalTaskIndex = function( task ) {
    if( timelineManager.getGanttInstance().getGlobalTaskIndex( task.id ) === 0 ) {
        return '';
    }
    return timelineManager.getGanttInstance().getGlobalTaskIndex( task.id );
};

/**
 * Method for getting the ID of the Selected task.
 *
 * @return The id of the selected task.
 */
export let getSelectedTaskID = function() {
    return timelineManager.getGanttInstance().getSelectedId();
};

/**
 * Method for removing the selection of currently selected task.
 */
export let removeTaskSelection = function() {
    let id = exports.getSelectedTaskID();
    timelineManager.getGanttInstance().unselectTask( id );
};

/**
 * Method for cleanup. Like removing event handlers etc.
 */
export let cleanup = function() {
    timelineEventHandler.unregisterEventHandlers();
    timelineManager.destroyGanttInstance();
    padding = '';
};

/**
 *registering Ctx for command panel of stacked events
 */
export let registerContextForStackedEventPanel = function() {
    var flag = false;
    appCtx.registerCtx( 'toUpdateStackEventPanel', flag );
    appCtx.registerCtx( 'toCloseStackEventPanel', flag );
};

/**
 *Unregistering Ctx for command panel of stacked events
 */
export let unregisterContextForStackedEventPanel = function() {
    appCtx.unRegisterCtx( 'toUpdateStackEventPanel' );
    appCtx.unRegisterCtx( 'toCloseStackEventPanel' );
};

/**
 * Method for finding the offset for zoom levels for stacked events
 *
 */
export let setOffsetForZoomLevel = function() {
    let zoomLevel = appCtx.getCtx( 'popupContext.timelineViewType' );
    let offset = 0;
    if( zoomLevel === 'unit_of_time_measure' ) {
        let contextObj = appCtx.getCtx( 'selected' );
        if( contextObj.props.prg0UnitOfTimeMeasure ) {
            zoomLevel = mappingForUnitOfTimeStackCount( contextObj.props.prg0UnitOfTimeMeasure.dbValues[ 0 ] );
        }
    }
    switch ( zoomLevel ) {
        case 'day':
            offset = 3;
            break;
        case 'week':
            offset = 12;
            break;
        case 'month':
            offset = 48;
            break;
        case 'quarter':
            offset = 200;
            break;
        case 'year':
            offset = 360;
            break;
    }
    return offset;
};
/**
 * Method which depending on the zoom level calcluates the stack count of the overlapping events
 * It finally creates a map with key as the parent plan uid and the value as a map with key as topmost event on the stack and the value as the stack count
 */
export let findCountWithZoomeLevel = function( objectType ) {
    let offsetAccordingToZoom = setOffsetForZoomLevel();
    let mapOfPlansEventInfo; // map of parent plan as key and value as the map of left event UID with it's right event Uid and offset
    if( objectType === 'Milestone' ) {
        mapOfPlansEventInfo = appCtx.getCtx( 'popupContext.mapParentPlanMilestone' );
    } else {
        mapOfPlansEventInfo = appCtx.getCtx( 'popupContext.mapParentPlanEvent' );
    }
    let stackEventCountMap = new Map(); //map to be pushed in the ctx with topMostEventUid and stackCount.
    if( mapOfPlansEventInfo ) {
        for( const [ parentPlanUid, mapOfEventInfo ] of mapOfPlansEventInfo.entries() ) {
            let renderedMap = new Map();
            let arrayOfEvents = [];
            for( const [ leftEventUid, adjacentEventInfo ] of mapOfEventInfo.entries() ) {
                if( adjacentEventInfo.offset <= offsetAccordingToZoom ) {
                    if( renderedMap.size > 0 && arrayOfEvents.length >= 1 ) {
                        for( const [ topEventUid, stackCount ] of renderedMap.entries() ) {
                            if( leftEventUid === topEventUid ) {
                                var topMostEventUid = adjacentEventInfo.rightEventUid;
                                arrayOfEvents.push( adjacentEventInfo.rightEventUid );
                                renderedMap.delete( topEventUid ); //removing the old entry as another event is found to be above the entry in the map
                                renderedMap.set( topMostEventUid, arrayOfEvents );
                            }
                        }
                    } else if( arrayOfEvents.length < 1 ) {
                        arrayOfEvents.push( leftEventUid );
                        arrayOfEvents.push( adjacentEventInfo.rightEventUid );
                        let topEventUid = adjacentEventInfo.rightEventUid;
                        renderedMap.set( topEventUid, arrayOfEvents );
                    }
                } else {
                    arrayOfEvents = []; //reinitialising the stackcount to 1 once chain of overlapping events is broken
                }
            }
            stackEventCountMap.set( parentPlanUid, renderedMap ); // map of parent plan uid and the topMost event uid, stack count
        }
    }
    if( objectType === 'Milestone' ) {
        appCtx.updatePartialCtx( 'popupContext.stackMilestoneCountMap', stackEventCountMap );
    } else {
        appCtx.updatePartialCtx( 'popupContext.stackEventCountMap', stackEventCountMap );
    }
};

/**
 * updating the ctx and reinitialising them when a zoom level is changed on the timeline
 * @param {string} viewType
 */
export let updateStackCountOnZoom = function( viewType ) {
    appCtx.ctx.popupContext.timelineViewType = viewType;
    let render = new Map();
    appCtx.ctx.popupContext.stackEventCountMap = render;
    appCtx.ctx.popupContext.stackMilestoneCountMap = render;
    findCountWithZoomeLevel( 'Event' );
    findCountWithZoomeLevel( 'Milestone' );
};

/**
 * Method for showing events in the pop up and panel.
 * @param {data} data
 * @param {boolean} flag to know whether pop up or panel
 */
export let eventsToShowInPopUp = function( data, flag ) {
    let stackTimelineObjCountMap;
    let selectedObj = appCtx.getCtx( 'selected' );
    var isMilestone = false;

    if( selectedObj.modelType.typeHierarchyArray.indexOf( 'ScheduleTask' ) > -1 ) {
        isMilestone = true;
        data.selectedType = 'Milestones';
        stackTimelineObjCountMap = appCtx.getCtx( 'popupContext.stackMilestoneCountMap' );
    } else {
        data.selectedType = 'Events';
        stackTimelineObjCountMap = appCtx.getCtx( 'popupContext.stackEventCountMap' );
    }
    let searchResults = [];
    let timelineObj = timelineManager.getGanttInstance().getSelectedId();
    let parentPlanUid = timelineManager.getGanttInstance().getParent( timelineObj );
    //In the usecase of milestones, the timelineObj contains "uid__parentID" as a key. Hence it is split by __ to get only uid to be used for matching further in if( timelineObj === stackedEvent ) block.
    //In the case of events, the timelineObj will contain only uid and the split will keep it same.
    timelineObj = timelineObj.split( '__' )[ 0 ];
    for( const [ parentPlanEventUid, overlapEventMap ] of stackTimelineObjCountMap.entries() ) {
        //IF check added for duplicate milestones assigned to multiple plans levels
        if( parentPlanUid === parentPlanEventUid ) {
            for( const [ topmostEventUid, otherEventsInfo ] of overlapEventMap.entries() ) {
                otherEventsInfo.forEach( ( stackedEvent ) => {
                    if( timelineObj === stackedEvent ) {
                        otherEventsInfo.forEach( ( stackEventUid ) => {
                            var test = _cdm.getObject( stackEventUid );
                            searchResults.push( test );
                        } );
                    }
                } );
            }
        }
    }
    //This would make the results in order according to planned date.
    searchResults.reverse();
    //This is because we always want the selected event to be part of the pop up of stacked event at the third position if it's at a later planned date.
    let index = _.findIndex( searchResults, function( node ) {
        return node.uid === selectedObj.uid;
    } );
    if( index > 2 ) {
        searchResults.splice( index, 1 );
        var firstEvent = _cdm.getObject( selectedObj.uid );
        searchResults.splice( 2, 0, firstEvent );
    }
    if( !flag ) {
        data.searchResults = searchResults.splice( 0, 3 );
    } else if( flag ) {
        data.searchResults = searchResults;
    }
    data.selectTest = appCtx.getCtx( 'selectUidTest' );

    /* If Milestones are present then load 'awp0CellProperties' property to show stacked panel. To improve performance this property is
        not loaded during the initial call to the data provider.
    */
    var milestoneObjects = [];
    if( isMilestone ) {
        _.forEach( data.searchResults, function( searchObject ) {
            milestoneObjects.push( searchObject.uid );
        } );
        return dmSvc.getProperties( milestoneObjects, [ 'awp0CellProperties' ] ).then( function() {
            return;
        } );
    }
    return data.selectedType;
};

/**
 * Method to update the selection in the popup so as to update the summary view/ info panel
 * @param {data} data
 */
export let updateSelectionInPopup = function( listDataProvider ) {
    selectionService.updateSelection( listDataProvider.selectedObjects[ 0 ], appCtx.ctx.pselected );
};

/**
 * Toggles the value of 'showTimeline' variable in ctx.
 */
export const toggleTimeline = () => {
    let isTimelineOn = appCtx.getCtx( 'showTimeline' );
    appCtx.updateCtx( 'showTimeline', !isTimelineOn );

    let boolStrArray = [ !isTimelineOn ? 'true' : 'false' ];
    preferenceService.setStringValue( 'AW_SubLocation_PlanNavigationSubLocation_ShowTimeline', boolStrArray );
    appCtx.updateCtx( 'preferences.AW_SubLocation_PlanNavigationSubLocation_ShowTimeline', boolStrArray );
};

/**
 * Method to highlight the event in the pop up and command panel in case of stacked event
 * @param {data} data
 */
export let showHighlightedEventInPopup = ( listDataProvider ) => {
    let selection = appCtx.ctx.selected.uid;
    let vmc = listDataProvider.viewModelCollection;
    var index = vmc.findViewModelObjectById( selection );
    if( index > -1 ) {
        var vmo = vmc.getViewModelObject( index );
        listDataProvider.selectionModel.setSelection( vmo );
    }
};

/**
 * Method to recalculate the stacked events in timeline for addition, updation
 * @param {object} eventUid UID of the event being added/updated
 * @param {boolean} whetherAddEvent  flag to tell updation(false value) or creation(true value) has happened
 */
export let recalculateStackedEvents = function( eventUid, whetherAddEvent ) {
    let eventObject = _cdm.getObject( eventUid );
    let parentPlanUid = eventObject.props.prg0PlanObject.dbValues[ 0 ];
    let childObjectIds = timelineManager.getGanttInstance().getChildren( parentPlanUid );
    let events = [];
    childObjectIds.forEach( objectId => {
        let modelObject = _cdm.getObject( objectId );
        if( modelObject && cmm.isInstanceOf( 'Prg0AbsEvent', modelObject.modelType ) ) {
            events.push( modelObject );
        }
    } );
    updateStackedEventCount( parentPlanUid, events, whetherAddEvent );
};

let updateStackedEventCount = function( parentPlanUid, events, renderWholeGantt ) {
    events.sort( ( event1, event2 ) => event1.props.prg0PlannedDate.dbValues[ 0 ] > event2.props.prg0PlannedDate.dbValues[ 0 ] ? 1 : -1 );
    let eventOffsetMap = exports.findAdjEventAndOffset( events );
    let planToEventOffsetMap = appCtx.ctx.popupContext.mapParentPlanEvent;
    planToEventOffsetMap.set( parentPlanUid, eventOffsetMap );
    appCtx.ctx.popupContext.mapParentPlanEvent = planToEventOffsetMap;
    findCountWithZoomeLevel( 'Event' );
    if( renderWholeGantt ) {
        timelineManager.getGanttInstance().render();
    } else {
        events.forEach( ( event ) => {
            timelineManager.getGanttInstance().refreshTask( event.uid );
        } );
    }
};

export let findAdjEventAndOffset = function( events ) {
    let mapOfEventAndOffset = new Map();
    let i;
    if( events.length > 1 ) {
        for( i = 1; i <= events.length - 1; ++i ) {
            var rightEventUid = events[ i ].uid;
            var leftEventUid = events[ i - 1 ].uid;
            var rightEventDate = new Date( events[ i ].props.prg0PlannedDate.dbValues[ 0 ] );
            var leftEventDate = new Date( events[ i - 1 ].props.prg0PlannedDate.dbValues[ 0 ] );
            var rightDate = rightEventDate.getTime();
            var leftDate = leftEventDate.getTime();
            var offset = ( rightDate - leftDate ) / 3600000; //in hours
            mapOfEventAndOffset.set( leftEventUid, { rightEventUid, offset } );
        }
    }
    return mapOfEventAndOffset;
};

/**
 * Method for adding Today Marker.
 */
export let addTodayMarker = function() {
    var date_to_str = timelineManager.getGanttInstance().date
        .date_to_str( timelineManager.getGanttInstance().config.task_date );
    var today = new Date();
    var todayMarker = {};
    todayMarker.start_date = today;
    var todayText = timelineManager.getGanttInstance().locale.labels.today;
    todayMarker.css = 'today';
    todayMarker.text = '';
    let todayDateStr = dateTimeService.formatSessionDate( today );
    todayMarker.title = todayText + ': ' + todayDateStr;
    var ganttInstance = timelineManager.getGanttInstance();
    var todayId = timelineManager.getGanttInstance().addMarker( todayMarker );
    setInterval( function() {
        if( ganttInstance ) {
            var todayTimelineMarker = ganttInstance.getMarker( todayId );
            if( typeof todayTimelineMarker !== 'undefined' ) {
                todayTimelineMarker.start_date = new Date();
                todayDateStr = dateTimeService.formatSessionDate( today );
                todayTimelineMarker.title = todayText + ': ' + todayDateStr;
                ganttInstance.updateMarker( todayId );
                timelineEventHandler.updateTodayMarkerHeight();
            }
        }
    }, 1000 * 60 );
};

/**
 * Get the Task from DHTMLX timeline
 * @param {String} taskUid The Uid of Gantt task to get
 * @returns {Object} The DHTMLX timeline Task
 */
export let getTimelineTask = ( taskUid ) => {
    let ganttTask;
    if( taskUid && timelineManager.getGanttInstance().isTaskExists( taskUid ) ) {
        ganttTask = timelineManager.getGanttInstance().getTask( taskUid );
    }
    return ganttTask;
};

/**
 * Get all events from DHTMLX timeline
 *
 * @return {Array} events event list from timeline
 */
export let getEventsFromTimeLine = () => {
    let events = [];
    // get all event list from timeline using DHTMLX API
    timelineManager.getGanttInstance().eachTask( function( task ) {
        let modelObject = _cdm.getObject( task.id.split( '__' )[ 0 ] );
        if( modelObject && modelObject.modelType && _cmm.isInstanceOf( 'Prg0AbsEvent', modelObject.modelType ) ) {
            events.push( modelObject );
        }
    } );
    return events;
};

/**
 * Get updated even color properties using getPropertySOACall
 */
export let getEventsAndUpdateColorProperty = () => {
    let events = exports.getEventsFromTimeLine();
    if( events && events.length > 0 ) {
        // get updated event color property values
        dmSvc.getPropertiesUnchecked( events, [ 'pgp0EventColor' ] ).then( function() {
            let eventData = {
                eventObjectList: events
            };
            eventBus.publish( 'updateEventsColorPropertyEvent', eventData );
        } );
    }
};

/**
 * update color properties all events from timeline
 */
export let updateEventsColorProperty = () => {
    let events = exports.getEventsFromTimeLine();
    if( events && events.length > 0 ) {
        _.forEach( events, function( currentEvent ) {
            let event = exports.getTimelineTask( currentEvent.uid );
            // assign updated color value to event object from timeline
            if( currentEvent.props.pgp0EventColor ) {
                event.color = currentEvent.props.pgp0EventColor.dbValues[ 0 ];
            }
        } );
    }
};

/**
 * Method for parsing and showing the Plan and Event in Timeline.
 * @param {Array} timelineObjects The objects array to be shown in Timeline
 */
export let parseGanttData = function( timelineObjects, links ) {
    let timelineData = {
        data: timelineObjects ? timelineObjects : [],
        links: links ? links : []
    };
    var scrollState = timelineManager.getGanttInstance().getScrollState();
    timelineManager.getGanttInstance().parse( timelineData, 'json' );
    timelineManager.getGanttInstance().scrollTo( scrollState.x, scrollState.y );
};

export default exports = {
    updatePositionsForEventInfo,
    setZoomParamForEventPosition,
    setInputParamForEventPosition,
    assureCSSInitialization,
    initializeConfigurations,
    setTimelineConfig,
    setDefaultColumns,
    initLocale,
    showMoreData,
    refreshTimeline,
    addCreatedObjectsOnTimeline,
    removeDeletedObjectsOnTimeline,
    removeDeletedObjectsOnTimeline2,
    getGlobalTaskIndex,
    getSelectedTaskID,
    removeTaskSelection,
    cleanup,
    quarterLabel,
    updatePreferenceForTimelineZoom,
    setTimelineZoomLevel,
    loadTimelineScale,
    goToDate,
    findCountWithZoomeLevel,
    updateStackCountOnZoom,
    eventsToShowInPopUp,
    setOffsetForZoomLevel,
    updateSelectionInPopup,
    unregisterContextForStackedEventPanel,
    registerContextForStackedEventPanel,
    toggleTimeline,
    showHighlightedEventInPopup,
    recalculateStackedEvents,
    updateStackedEventCount,
    findAdjEventAndOffset,
    getTimelineTask,
    getEventsFromTimeLine,
    getEventsAndUpdateColorProperty,
    updateEventsColorProperty,
    parseGanttData,
    mappingForUnitOfTimeStackCount,
    addTodayMarker
};
