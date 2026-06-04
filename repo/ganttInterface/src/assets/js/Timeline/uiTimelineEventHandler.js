//@<COPYRIGHT>@
//==================================================
//Copyright 2017.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/**
 * @module js/Timeline/uiTimelineEventHandler
 */
import timelineManager from 'js/uiGanttManager';
import eventBus from 'js/eventBus';
import appCtx from 'js/appCtxService';
import selectionSvc from 'js/selection.service';
import cdm from 'soa/kernel/clientDataModel';
import navigationSvc from 'js/locationNavigation.service';
import timelineUtils from 'js/Timeline/uiTimelineUtils';
import popupSvc from 'js/popupService';
import _ from 'lodash';
import _cmm from 'soa/kernel/clientMetaModel';

var exports = {};
var _events = [];
var _awEvents = [];
let _locChangeStart = null;
var stackEventDragCase = false;
let _planNavTreeUtils = {};
let _planNavScrollService = {};

/**
 * Adds the default events.
 * @param {Object} timelineDataSource Instance of TimelineDataSource
 */
export let addDefaultEvents = function( timelineDataSource ) {
    //Before Dependency link addition
    var onBeforeLinkAdd = timelineManager.getGanttInstance().attachEvent( 'onBeforeLinkAdd', function( id, link ) {
        var isLinkPersistent = timelineDataSource.isValidLink( id );
        if( !isLinkPersistent ) {
            //Create the link.
            timelineDataSource.createLink( link.type, link.source, link.target );
            return false; //Block the Link add to the GUI.
        }
        return true; //Allows adding the link to the GUI.
    } );
    _events.push( onBeforeLinkAdd );

    // on Double click Dependency link
    var linkDblClickEvent = timelineManager.getGanttInstance().attachEvent( 'onLinkDblClick', function( id ) {
        return timelineDataSource.deleteDependency( id );
    } );
    _events.push( linkDblClickEvent );

    // on click Dependency link
    var linkClickEvent = timelineManager.getGanttInstance().attachEvent( 'onLinkClick', function( id ) {
        timelineManager.getGanttInstance().unselectTask();

        // Publish event for setup the Program Board
        eventBus.publish( 'setupProgramBoard.selectionChanged', id );

        return timelineDataSource.selectLink( id );
    } );
    _events.push( linkClickEvent );


    // Event Drag Handlers
    var beforeTaskDragEvent = timelineManager.getGanttInstance().attachEvent( 'onBeforeTaskDrag', function( id, mode ) {
        var matched = id.indexOf( '__' );
        if ( matched > -1 ) {
            id = id.substring( 0, matched );
        }
        var timelineObject = cdm.getObject( id );
        //Blocks dragging if selected object is Schedule Milestone
        if( timelineObject.modelType.typeHierarchyArray.indexOf( 'ScheduleTask' ) > -1 ) {
            return false;
        }
        return true;
    } );
    _events.push( beforeTaskDragEvent );

    var afterTaskDragEvent = timelineManager.getGanttInstance().attachEvent( 'onAfterTaskDrag', function( id, mode ) {
        var taskExists = timelineManager.getGanttInstance().isTaskExists( id );
        if( taskExists ) {
            var task = timelineManager.getGanttInstance().getTask( id );
            var plannedDate = task.start_date.toGMTString();
            timelineDataSource.onEventDrag( id, plannedDate, mode );
        }
    } );
    _events.push( afterTaskDragEvent );

    //-------------------------------------------------------------------------------------------------------------
    //selection Event handlers
    var selectedEvent = timelineManager.getGanttInstance().attachEvent( 'onTaskSelected', function( id, item ) {
        //extra check added for schedule milestones
        var matched = id.indexOf( '__' );
        if ( matched > -1 ) {
            id = id.substring( 0, matched );
        }
        console.log( 'Selected ID :' + id );

        //If previously selected object is Dependency link the unselect it
        // if( _cmm.isInstanceOf( 'Prg0EventDependencyRel', appCtx.ctx.selected.modelType ) ) {
        //     timelineDataSource.unSelectLink();
        // }
        timelineDataSource.select( id );
        var timelineContext = appCtx.getCtx( 'timelineContext' );
        timelineContext.selected = appCtx.ctx.selected;
        appCtx.updateCtx( 'timelineContext', timelineContext );
        timelineManager.getGanttInstance().refreshTask( id );
        if( !appCtx.ctx.isPopupOpen ) {
            popupOpen( id );
            appCtx.ctx.topEventUid = id;
            stackEventDragCase = false;
        }
    } );
    _events.push( selectedEvent );

    var unSelectedEvent = timelineManager.getGanttInstance().attachEvent( 'onTaskUnselected', function( id, item ) {
        //extra check added for schedule milestones
        var matched = id.indexOf( '__' );
        if ( matched > -1 ) {
            id = id.substring( 0, matched );
        }
        console.log( 'Selected ID :' + id );
        timelineDataSource.deSelect();
        var timelineContext = appCtx.getCtx( 'timelineContext' );
        timelineContext.selected = appCtx.ctx.selected;
        appCtx.updateCtx( 'timelineContext', timelineContext );
        if( appCtx.ctx.topEventUid === id ) {
            appCtx.updateCtx( 'isPopupOpen', false );
            appCtx.ctx.firstOverlapEvent = '';
        }
    } );
    _events.push( unSelectedEvent );

    //-------------------------------------------------------------------------------------------------------------
    var onTaskClick = timelineManager.getGanttInstance().attachEvent(
        'onTaskClick',
        function( id, e ) {
            stackEventDragCase = true;
            var timelineObjID = id;
            var target = e.target || e.srcElement;
            var matched = id.indexOf( '__' );
            if ( matched > -1 ) {
                id = id.substring( 0, matched );
            }
            if( target.className.indexOf( 'gantt_tooltip_open_icon' ) !== -1 || target.className.indexOf( 'gantt_tree_open_icon' ) !== -1 ) {
                openObject( id );
                return false;
            } else if( timelineManager.getGanttInstance().getSelectedId() === timelineObjID &&
                target.className.indexOf( 'gantt_tree_icon' ) === -1 ) {
                timelineManager.getGanttInstance().unselectTask( timelineObjID );
                return false;
            }
            // Publish event for setup the Program Board
            eventBus.publish( 'setupProgramBoard.selectionChanged', id );

            return true;
        } );
    _events.push( onTaskClick );

    //-------------------------------------------------------------------------------------------------------------
    var popupOpen = function( id ) {
        let timelineObj = cdm.getObject( id );
        let stackedObjectCount;
        if( timelineObj.modelType.typeHierarchyArray.indexOf( 'ScheduleTask' ) > -1 ) {
            stackedObjectCount = appCtx.getCtx( 'popupContext.stackMilestoneCountMap' );
        } else{
            stackedObjectCount = appCtx.getCtx( 'popupContext.stackEventCountMap' );
        }
        if( stackedObjectCount.size > 0 && appCtx.ctx.isStackEventPanelActive === false ) {
            for( const [ parentPlanEventUid, overlapEventMap ] of stackedObjectCount.entries() ) {
                for( const [ topmostEventUid, otherEventsInfo ] of overlapEventMap.entries() ) {
                    //This handles the case when drag and drop results in a different order of Icons of event on timeline.
                    let index = _.findIndex( otherEventsInfo, function( stackedEventsUid ) {
                        return id === stackedEventsUid || appCtx.ctx.firstOverlapEvent === id;
                    } );
                    if( ( topmostEventUid === id || index >= 0 ) && appCtx.ctx.firstOverlapEvent !== id ) {
                        appCtx.ctx.popupContext.eventsCount = otherEventsInfo.length;
                        let data = {
                            declView: 'Pgp0ShowOverlapEvents',
                            options: {
                                reference: '.gantt_selected',
                                detachMode: true,
                                resizeToClose: true,
                                whenParentScrolls: 'close',
                                placement: 'right-start',
                                hasArrow: true,
                                arrowOptions: {
                                    alignment: 'center',
                                    shift: 5
                                },
                                width: 250
                            }
                        };
                        popupSvc.show( data );
                        appCtx.ctx.firstOverlapEvent = topmostEventUid;
                    }
                }
            }
        }
        //To handle the closing and updation of the panel
        let flag = false;
        if( appCtx.ctx.isStackEventPanelActive === true ) {
            for( const [ parentPlanEventUid, overlapEventMap ] of stackedObjectCount.entries() ) {
                for( const [ topmostEventUid, otherEventsInfo ] of overlapEventMap.entries() ) {
                    let overlapIndex = _.findIndex( otherEventsInfo, function( stackedEventsUid ) {
                        return id === stackedEventsUid || appCtx.ctx.firstOverlapEvent === id;
                    } ); //This handles the case when drag and drop results in a different order of Icons.
                    if( ( id === topmostEventUid || overlapIndex >= 0 ) && appCtx.ctx.firstOverlapEvent !== id ) {
                        flag = true;
                        if( stackEventDragCase === true ) {
                            appCtx.updateCtx( 'toUpdateStackEventPanel', true );
                        }
                    }
                }
            }
        }
        if( !flag ) {
            for( const [ parentPlanEventUid, overlapEventMap ] of stackedObjectCount.entries() ) {
                for( const [ topmostEventUid, otherEventsInfo ] of overlapEventMap.entries() ) {
                    let index = _.findIndex( otherEventsInfo, function( stackedEventUids ) {
                        return id !== stackedEventUids;
                    } );
                    if( index >= 0 ) {
                        appCtx.updateCtx( 'toCloseStackEventPanel', true );
                    }
                }
            }
        }
    };

    //-------------------------------------------------------------------------------------------------------------
    var onGanttRender = timelineManager.getGanttInstance().attachEvent(
        'onGanttRender',
        function() {
            exports.updateTodayMarkerHeight();
            //TODO Currently its called multiple times, find an event when the tree is rendered on the screen and remove this
            // Listen to table scroll to sync up Gantt scroll
            _planNavScrollService.registerTable2TimelineScrollSync();
            return;
        } );
    _events.push( onGanttRender );

    //-------------------------------------------------------------------------------------------------------------
    var onTaskOpened = timelineManager.getGanttInstance().attachEvent(
        'onTaskOpened',
        function() {
            exports.updateTodayMarkerHeight();
            return;
        } );
    _events.push( onTaskOpened );

    //-------------------------------------------------------------------------------------------------------------
    var onTaskClosed = timelineManager.getGanttInstance().attachEvent(
        'onTaskClosed',
        function() {
            exports.updateTodayMarkerHeight();
            return;
        } );
    _events.push( onTaskClosed );

    //--------------------------------------------------
    var onScaleClick = timelineManager.getGanttInstance().attachEvent(
        'onScaleClick',
        function( e, date ) {
            timelineUtils.loadTimelineScale( timelineManager.getGanttInstance().config.scale_unit );
            var eventData = {
                viewType: timelineManager.getGanttInstance().config.scale_unit
            };
            timelineUtils.updateStackCountOnZoom( eventData.viewType );
            timelineManager.getGanttInstance().render();
            eventBus.publish( 'onScaleClickEvent', eventData );
        } );
    _events.push( onScaleClick );

    var onTimelineScroll = timelineManager.getGanttInstance().attachEvent( 'onGanttScroll', function( e, i, n, a ) {
        // If in Schedule Navigation sublocation, sync the tree table scroll bar.
        if( _planNavTreeUtils.isPlanNavigationSublocation() ) {
            _planNavScrollService.scrollTable();
        }
    } );
    _events.push( onTimelineScroll );

    let onBeforeTaskDisplay = timelineManager.getGanttInstance().attachEvent( 'onBeforeTaskDisplay', function( id, task ) {
        if ( task.rollup ) {
            return false;
        }
        return true;
    } );
    _events.push( onBeforeTaskDisplay );


    timelineManager.getGanttInstance().event( window, 'click', function( e ) {
        var target = e.target;
        if( target.className === 'gantt_tooltip_open_icon' ) {
            var taskId = target.getAttribute( 'task_id' );
            if( taskId ) {
                openObject( taskId );
            }
        }
    } );
};


/**
 * Registers AW generic events
 * @param {Object} timelineDataSource  Instance of TimelineDataSource
 */
export let registerAWEvents = function( timelineDataSource ) {
    // push this event as last in _events to differentiate from Gantt related events
    _awEvents.push( eventBus.subscribe( 'appCtx.register', function( eventData ) {
        if( eventData.name === 'xrtSummaryContextObject' ) {
            let taskId = timelineManager.getGanttInstance().getSelectedId();
            if( eventData.value && eventData.value.uid === taskId ) {
                selectionSvc.updateSelection( cdm.getObject( taskId ), appCtx.ctx.locationContext.modelObject );
            }
        }
    } ) );


    // Sync node toggle (open/close) actions
    _awEvents.push( eventBus.subscribe( 'planNavigationTree.plTable.toggleTreeNode', function( node ) {
        if( node.isExpanded === true ) {
            timelineManager.getGanttInstance().open( node.id );
        } else {
            timelineManager.getGanttInstance().close( node.id );
        }
    } ) );

    _awEvents.push( eventBus.subscribe( 'planNavigationTree.nodesAdded', eventData => {
        if( eventData.addedNodes && eventData.addedNodes.length > 0 ) {
            timelineDataSource.addPlanObjects( eventData.addedNodes );
        }
    } ) );

    _awEvents.push( eventBus.subscribe( 'planNavigationTree.eventsAdded', eventData => {
        if( eventData.addedEvents && eventData.addedEvents.length > 0 ) {
            timelineDataSource.addEventObjects( eventData.addedEvents );
        }
    } ) );
};

/**
 * Method for opening an object.
 *
 * @param {object} taskUid - The Uid of object to be opened.
 */
var openObject = function( taskUid ) {
    var showObject = 'com_siemens_splm_clientfx_tcui_xrt_showObject';
    var toParams = {};
    var options = {};

    toParams.uid = taskUid;
    options.inherit = false;

    var xrtContext = appCtx.getCtx( 'ActiveWorkspace:xrtContext' );
    if( xrtContext ) {
        xrtContext.timelineWithDetails = 0;
        appCtx.updateCtx( 'ActiveWorkspace:xrtContext', xrtContext );
    }

    navigationSvc.instance.go( showObject, toParams, options );
};

/**
 * Method for registering an event.
 *
 * @param {object} event - The event object.
 */
export let registerEvent = function( event ) {
    _events.push( event );
};

/**
 * Method for to unregister the events.
 */
export let unregisterEventHandlers = function() {
    if( _events.length > 0 ) {
        for( var i = 0; i < _events.length; i++ ) {
            timelineManager.getGanttInstance().detachEvent( _events[ i ] );
        }
        _events = [];
    }
    if( _awEvents.length > 0 ) {
        for( var i = 0; i < _awEvents.length; i++ ) {
            var event = _awEvents[ i ];
            if( event ) {
                eventBus.unsubscribe( event );
            }
        }
        _awEvents = [];
    }
    _locChangeStart = null;

    // Stop listening to table scroll.
    _planNavScrollService.unRegisterTable2TimelineScrollSync();
    _planNavTreeUtils = {};
    _planNavScrollService = {};
    _planNavTreeUtils = {};
    _planNavScrollService = {};
};

export let updateTodayMarkerHeight = function() {
    // if( timelineManager.getGanttInstance().$marker_area && timelineManager.getGanttInstance().$marker_area.childNodes.length > 0 ) {
    //     timelineManager.getGanttInstance().$marker_area.childNodes[ '0' ].style.height = Math.max( timelineManager.getGanttInstance()._y_from_ind( timelineManager.getGanttInstance()._planOrder.length ),
    //         0 ) + 'px';
    // }
};

export let getTimelineManeger = function() {
    return timelineManager.getGanttInstance();
};

export let setPlanNavTreeUtils = function( planNavTreeUtils ) {
    _planNavTreeUtils = planNavTreeUtils;
};

export let setPlanNavTreeScrollService = function( planNavScrollService ) {
    _planNavScrollService = planNavScrollService;
};

export default exports = {
    addDefaultEvents,
    registerAWEvents,
    registerEvent,
    unregisterEventHandlers,
    updateTodayMarkerHeight,
    getTimelineManeger,
    setPlanNavTreeUtils,
    setPlanNavTreeScrollService
};
