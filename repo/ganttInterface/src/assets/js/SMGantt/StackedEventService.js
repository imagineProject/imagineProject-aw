// Copyright (c) 2022 Siemens

/**
 * Service for displaying stacked events
 * @module js/SMGantt/StackedEventService
 */
import appCtx from 'js/appCtxService';
import selectionService from 'js/selection.service';
import popupSvc from 'js/popupService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import awPromiseService from 'js/awPromiseService';
import GanttConstants from 'js/SMGantt/GanttConstants';

let exports = {};
let _popupRef;

/**
 * prepares a map of map of {parent -> {leftEventUid: {rightEventUid: offset} }
 * @param {array} events - model event objects
 * @return {string} parent - The parent object uid.
 */
export let prepareMapParentEventInfo = ( events, parent )=> {
    let mapOfAdjEventAndOffset = new Map();
    let mapPlanEventInfo = new Map();
    if ( events && events.length > 0 ) {
        mapOfAdjEventAndOffset = prepareAdjEventAndOffset( events );
        mapPlanEventInfo.set( parent, mapOfAdjEventAndOffset );
    }
    return mapPlanEventInfo;
};


export let prepareAdjEventAndOffset = ( events ) => {
    let mapOfEventAndOffset = new Map();
    if ( events.length > 1 ) {
        for ( let i = 1; i <= events.length - 1; ++i ) {
            let rightEventUid = events[i].uid;
            let leftEventUid = events[i - 1].uid;
            let rightEventDate = new Date( events[i].props.prg0PlannedDate.dbValues[0] );
            let leftEventDate = new Date( events[i - 1].props.prg0PlannedDate.dbValues[0] );
            let rightDate = rightEventDate.getTime();
            let leftDate = leftEventDate.getTime();
            let offset = ( rightDate - leftDate ) / GanttConstants.GANTT_MILLISECONDS_IN_HOUR; //in hours
            mapOfEventAndOffset.set( leftEventUid, { rightEventUid, offset } );
        }
    }
    return mapOfEventAndOffset;
};

/**
 * Method which depending on the zoom level calcluates the stack count of the overlapping events
 * It finally creates a map with key as the parent plan uid and the value as a map with key as topmost event on the stack and the value as the stack count
 * @param zoomOffSet zoomOffset 
 * @param parentEventInfoMap - map of parent uid -> map{leftEventUid: rightEventUid, offset}
 * @return stackEventCountMap - map of parent uid -> map{topEventUid -> eventsFromTheStack}
 */
export let prepareStackEventCountMapBasedOnZoomOffset = ( zoomOffSet, parentEventInfoMap ) =>{
    let stackEventCountMap = new Map(); //map to be pushed in the ctx with topMostEventUid and stackCount.
    for ( const [ parentUid, mapOfEventInfo ] of parentEventInfoMap.entries() ) {
        let renderedMap = new Map();
        let stackCount = 1;
        let arrayOfEvents = [];
        for ( const [ leftEventUid, adjacentEventInfo ] of mapOfEventInfo.entries() ) {
            if ( adjacentEventInfo.offset <= zoomOffSet ) {
                if ( renderedMap.size > 0 && arrayOfEvents.length >= 1 ) {
                    for ( const [ topEventUid, stackCount ] of renderedMap.entries() ) {
                        if ( leftEventUid === topEventUid ) {
                            let topMostEventUid = adjacentEventInfo.rightEventUid;
                            arrayOfEvents.push( adjacentEventInfo.rightEventUid );
                            renderedMap.delete( topEventUid ); //removing the old entry as another event is found to be above the entry in the map
                            renderedMap.set( topMostEventUid, arrayOfEvents );
                        }
                    }
                } else if ( arrayOfEvents.length < 1 ) {
                    arrayOfEvents.push( leftEventUid );
                    arrayOfEvents.push( adjacentEventInfo.rightEventUid );
                    let topEventUid = adjacentEventInfo.rightEventUid;
                    renderedMap.set( topEventUid, arrayOfEvents );
                }
            } else {
                arrayOfEvents = []; //reinitialising the stackcount to 1 once chain of overlapping events is broken
            }
        }
        stackEventCountMap.set( parentUid, renderedMap ); // map of parent plan uid and the topMost event uid, stack count
    }
    return stackEventCountMap;
};


/**
 * Updates the given context param with the stack event count map
 * @param ctxParamName - context parameter name
 * @return stackEventCountMap - map of parent uid -> map{topEventUid -> eventsFromTheStack}
 */
export let updateCtxWithStackEventCountMap = ( ctxParamName, stackEventCountMap )=> {
    appCtx.updatePartialCtx( ctxParamName, stackEventCountMap );
};


/**
 *Method for mapping the value in unit of time measure preference to the correct scale for stack count
 * @param {string} scale in unit of time measure
 */
export let mappingForUnitOfTimeStackCount = ( scale ) => {
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
 * Method for finding the offset for zoom levels for stacked events
 * @param ctxParamName the preference name  on the ctx object to get zoom offset from
 * @return zoom offset 
 */
export let getOffsetForZoomLevel = ( ctxParamName ) => {
    let ctxParamVal = appCtx.getCtx( ctxParamName );
    let zoomLevel;
    if( ctxParamVal && ctxParamVal.length > 0 ) {
        zoomLevel = ctxParamVal[0];
    } else{
        zoomLevel = GanttConstants.GANTT_STACKED_EVENT_ZOOMLEVEL_OFFSETS.WEEK;
    }

    let offset = 0;
    if ( zoomLevel === 'unit_of_time_measure' ) {
        let contextObj = appCtx.ctx.locationContext.modelObject;
        if ( contextObj.props.prg0UnitOfTimeMeasure ) {
            zoomLevel = mappingForUnitOfTimeStackCount( contextObj.props.prg0UnitOfTimeMeasure.dbValues[0] );
        }
    }
    switch ( zoomLevel ) {
        case 'day':
            offset = GanttConstants.GANTT_STACKED_EVENT_ZOOMLEVEL_OFFSETS.DAY;
            break;
        case 'week':
            offset = GanttConstants.GANTT_STACKED_EVENT_ZOOMLEVEL_OFFSETS.WEEK;
            break;
        case 'month':
            offset = GanttConstants.GANTT_STACKED_EVENT_ZOOMLEVEL_OFFSETS.MONTH;
            break;
        case 'quarter':
            offset = GanttConstants.GANTT_STACKED_EVENT_ZOOMLEVEL_OFFSETS.QUARTER;
            break;
        case 'year':
            offset = GanttConstants.GANTT_STACKED_EVENT_ZOOMLEVEL_OFFSETS.YEAR;
            break;
    }
    return offset;
};

/**
 * Method to update the selection in the popup so as to update the summary view/ info panel
 * @param {data} data
 */
export let updateSelectionInPopup = ( data )=> {
    selectionService.updateSelection( data.dataProviders.listDataProvider.selectedObjects[0], appCtx.ctx.pselected );
};


/**
 * Method to register ctx for handling stacked events on timeline
 */
export let registerContextForStackedEvents = () => {
    let viewType = 'month';
    let renderMap = new Map();
    let mapParentPlanEvent = new Map();
    let flag = false;
    if ( appCtx.ctx.preferences.AWC_SM_Gantt_Zoom_Level ) {
        if ( appCtx.ctx.preferences.AWC_SM_Gantt_Zoom_Level[0] === '' ) {
            if ( appCtx.ctx.locationContext.modelObject.props.prg0UnitOfTimeMeasure ) {
                viewType = mappingForUnitOfTimeStackCount( appCtx.ctx.locationContext.modelObject.props.prg0UnitOfTimeMeasure.dbValues[0] );
            }
        } else {
            let viewTypeTest = appCtx.ctx.preferences.AWC_SM_Gantt_Zoom_Level[0];
            if ( viewTypeTest === 'unit_of_time_measure' ) {
                if ( appCtx.ctx.locationContext.modelObject.props.prg0UnitOfTimeMeasure ) {
                    viewType = mappingForUnitOfTimeStackCount( appCtx.ctx.locationContext.modelObject.props.prg0UnitOfTimeMeasure.dbValues[0] );
                }
            } else {
                viewType = viewTypeTest;
            }
        }
    }
    let popupContext = {
        ganttViewType: viewType,
        stackEventCountMap: renderMap,
        mapParentPlanEvent: mapParentPlanEvent,
        eventsCount: 0
    };
    appCtx.registerCtx( 'popupContext', popupContext );
    appCtx.registerCtx( 'isStackEventPanelActive', flag );
    appCtx.registerCtx( 'isPopupOpen', flag );
};


/**
 * updating the ctx and reinitialising them when a zoom level is changed on the timeline
 * @param {string} viewType
 */
export let resetStackCountOnZoom = ( viewType ) => {
    appCtx.ctx.popupContext.ganttViewType = viewType;
    let stackEventCountMap = new Map();
    appCtx.ctx.popupContext.stackEventCountMap = stackEventCountMap;
    eventBus.publish( 'stackedEvents.resetOnZoom' );
};

/**
 * Adds the stacked count information to the template
 * @param {object} task - gantt task
 * @param {object} stackedObjCountMap - object with stacked object information
 */
export let addStackedEventElementToTemplate = ( task, stackedObjCountMap ) => {
    let stackVal = '';
    for ( const [ parentPlanUid, eventInfo ] of stackedObjCountMap.entries() ) {
        for ( let [ eventUid, stackCount ] of eventInfo.entries() ) {
            if ( task.id === eventUid ) {
                if ( appCtx.ctx.layout === 'comfy' ) {
                    stackVal = '<div class="gantt_task_stackedWithoutInfo"><div class="gantt_task_stackedCount">' + stackCount.length +
                        '</div>'; //for comfortable view with event info/find on
                } else if ( appCtx.ctx.layout === 'compact' ) {
                    stackVal = '<div class="gantt_task_stackedWithoutInfoCompact"><div class="gantt_task_stackedCount">' + stackCount.length +
                        '</div>'; //for compact view with event info on and find off
                }
            }
        }
    }
    return stackVal;
};

/**
 * Given the view and options opens the stacked event popup
 * @param {object} declView - the view to use for popup
 * @param {object} options - the options for the poup
 */
let showStackedEventPopup = function( declView, options ) {
    let deferred = awPromiseService.instance.defer();
    let data = {
        declView: declView,
        options: options
    };
    popupSvc.show( data ).then( function( popupRef ) {
        _popupRef = popupRef;
        deferred.resolve( popupRef );
    } );

    return deferred.promise;
};

/**
 * Closes the stacked event popup
 */
let closeStackedEventPopup = function() {
    let deferred = awPromiseService.instance.defer();
    if( _popupRef ) {
        popupSvc.hide( _popupRef );
        _popupRef = null;
        deferred.resolve( _popupRef );
    }

    return deferred.promise;
};

/**
 * Process the popup close -wrapper 
 */
let processStackedEventPopupClose = function() {
    closeStackedEventPopup().then( function() {
        appCtx.updateCtx( 'isPopupOpen', false );
        appCtx.ctx.firstOverlapEvent = '';
        // appCtx.ctx.topEventUid = taskId;
    } );
};

/**
 * Given the view and options opens the stacked event popup
 * @param {string} taskId - the selected task id
 * @param {Number} eventCount - the number of events in the stack of the selected task id
 */
let showStackedEventPopupPostProcess = function( taskId, eventCount ) {
    appCtx.updateCtx( 'isPopupOpen', true );
    appCtx.ctx.topEventUid = taskId;
    appCtx.ctx.popupContext.eventsCount = eventCount;
};

/**
 * Processes the given input and shows or hides popup for stacked events
 * @param {object} selectedModelObject - selected model object
 * @param {object} taskId - selected gantt task id
 */
export let processShowHidePopup = function( selectedModelObject, taskId ) {
    let smGanttCtx = appCtx.getCtx( 'smGanttCtx' );
    if( smGanttCtx.selectedEvent === selectedModelObject ) {
        return;
    }
    let options = {
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
    };

    smGanttCtx.selectedEvent = selectedModelObject;
    appCtx.ctx.selected = selectedModelObject;
    appCtx.updateCtx( 'smGanttCtx', smGanttCtx );
    let stackEventCountMap = appCtx.getCtx( 'popupContext.stackEventCountMap' );
    let stackInfo = getTaskStackMembershipInfo( taskId, stackEventCountMap );
    if( stackInfo.isStacked ) {
        if ( !_popupRef ) {
            showStackedEventPopup( 'Pgp0ShowOverlapEvents', options ).then( function() {
                showStackedEventPopupPostProcess( taskId, stackInfo.length );
            } );
        } else {
            if ( appCtx.ctx.isStackEventPanelActive ) {
                appCtx.updateCtx( 'toUpdateStackEventPanel', true );
            } else{
                closeStackedEventPopup().then( function() {
                    appCtx.updateCtx( 'isPopupOpen', false );
                    appCtx.ctx.firstOverlapEvent = '';
                    appCtx.ctx.topEventUid = taskId;
                    showStackedEventPopup( 'Pgp0ShowOverlapEvents', options ).then( function() {
                        showStackedEventPopupPostProcess( taskId, stackInfo.length );
                    } );
                } );
            }
        }
    } else{
        if( _popupRef ) {
            processStackedEventPopupClose();
            if( appCtx.ctx.isStackEventPanelActive ) {
                appCtx.updateCtx( 'toCloseStackEventPanel', true );
            }
        }
    }
};

/**
 * Checks if the task is stacked and returns the count of the stack
 * @param {string} taskId - id of the gantt task
 * @param {object} stackEventCountMap - map of parent uid -> map{topEventUid -> eventsFromTheStack}
 */
let getTaskStackMembershipInfo = function( taskId, stackEventCountMap ) {
    for ( const [ parentPlanEventUid, overlapEventMap ] of stackEventCountMap.entries() ) {
        for ( const [ topmostEventUid, otherEventsInfo ] of overlapEventMap.entries() ) {
            let index = _.findIndex( otherEventsInfo, function( stackedEventUid ) {
                return taskId === stackedEventUid || taskId === topmostEventUid;
            } );
            if ( index >= 0 ) {
                return {
                    isStacked : true,
                    length: otherEventsInfo.length
                };
            }
        }
    }
    return { isStacked : false };
};


export default exports = {
    prepareMapParentEventInfo,
    prepareStackEventCountMapBasedOnZoomOffset,
    updateCtxWithStackEventCountMap,
    mappingForUnitOfTimeStackCount,
    getOffsetForZoomLevel,
    addStackedEventElementToTemplate,
    registerContextForStackedEvents,
    processShowHidePopup,
    resetStackCountOnZoom
};
