// Copyright (c) 2022 Siemens

/**
 * @module js/ProgramView/uiProgramViewEventHandler
 */
import ganttManager from 'js/uiGanttManager';
import eventBus from 'js/eventBus';

var exports = {};
var _events = [];
var _awEvents = [];

export let registerGanttEvents = function( dataProcessor, data ) {
    var taskOpenedEvent = ganttManager.getGanttInstance().attachEvent( 'onTaskOpened', function( id ) {
        if( data.ganttOptions.isBranchPagination ) {
            dataProcessor.paginateForTaskOpened( id );
        }
    } );
    _events.push( taskOpenedEvent );
    var onScaleClick = ganttManager.getGanttInstance().attachEvent(
        'onScaleClick',
        function( e, date ) {
            dataProcessor.setScaleForGantt( ganttManager.getGanttInstance().config.scale_unit );
            ganttManager.getGanttInstance().render();
        } );
    _events.push( onScaleClick );
    var taskSelectedEvent = ganttManager.getGanttInstance().attachEvent( 'onTaskSelected', function( id ) {
        dataProcessor.selectNode( id );
    } );
    _events.push( taskSelectedEvent );
    var taskUnselectedEvent = ganttManager.getGanttInstance().attachEvent( 'onTaskUnselected', function( id ) {
        dataProcessor.deselectNode( id );
    } );
    _events.push( taskUnselectedEvent );
};

export let registerAWEvents = function( timelineDataSource ) {
    var paginationCompleteEvent = eventBus.subscribe( 'Saw1ProgramView.paginationComplete', function( eventData ) {
        var scrollState = ganttManager.getGanttInstance().getScrollState();
        var paginationData = eventData.saw1ProgramViewPaginationData;
        ganttManager.getGanttInstance().parse( paginationData );
        ganttManager.getGanttInstance().scrollTo( scrollState.x, scrollState.y );
    } );
    _awEvents.push( paginationCompleteEvent );

    // //listen to window resize event.
    // $(window).resize(resizer);
};

export let unregisterEvents = function() {
    for( var i = 0; i < _events.length; i++ ) {
        ganttManager.getGanttInstance().detachEvent( _events[ i ] );
    }
    _events = [];

    if( _awEvents.length > 0 ) {
        for( var i = 0; i < _awEvents.length; i++ ) {
            var event = _awEvents[ i ];
            if( event ) {
                eventBus.unsubscribe( event );
            }
        }
        _awEvents = [];
    }
};

export default exports = {
    registerGanttEvents,
    registerAWEvents,
    unregisterEvents
};
