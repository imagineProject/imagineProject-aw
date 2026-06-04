// Copyright (c) 2022 Siemens

import _ from 'lodash';
import awGanttStackedService from 'js/AwGanttStackedObjectsService';
import { gantt, Gantt } from '@swf/dhtmlxgantt';
import '@swf/dhtmlxgantt/skins/dhtmlxgantt_meadow.css';
import ganttLocaleService from 'js/AwGanttLocaleService';
import ganttSelectionService from 'js/AwGanttSelectionService';
import ganttZoomService from 'js/AwGanttZoomService';
import cdm from 'soa/kernel/clientDataModel';

/**
 * Render function for AwGanttChart
 * @param {*} props context for render function
 * @returns {JSX.Element} react component
 */
export const awGanttChartRenderFunction = ( props ) => {
    const { elementRefList } = props;
    const element = elementRefList.get( 'ganttChartElem' );
    const ganttClasses = [ 'aw-ganttInterface-ganttWrapper' ];
    ganttClasses.push( props.className );

    return (
        <div ref={element} className={ganttClasses.join( ' ' )}></div>
    );
};

export const initializeGanttChart = ( elementRefList, props ) => {
    console.log( 'AwGanttChartService initializeGanttChart' );

    const element = elementRefList.get( 'ganttChartElem' ).current;
    element.id = props.ganttId ? props.ganttId : 'AwGanttChart';
    element.style.height = '100%';

    let ganttInstance = Gantt.getGanttInstance();
    ganttInstance.plugins( { critical_path: true, tooltip: true, marker: true, multiselect: true } );

    props.ganttChartState && props.ganttChartState.callbacks && props.ganttChartState.callbacks.setGanttInstance( ganttInstance );
    attachEventCallbacks( ganttInstance, props );

    ganttInstance.i18n.setLocale( ganttLocaleService.getCurrentLocale() );
    ganttInstance.i18n.setLocale( ganttLocaleService.getLocaleOverride() );
    addTodayMarker( ganttInstance );
    ganttInstance.init( element );

    if( props.ganttChartState ) {
        if( props.ganttChartState.getValue().initData ) {
            ganttInstance.parse( props.ganttChartState.getValue().initData );
        }
        props.ganttChartState.update( { ...props.ganttChartState.getValue(), ganttInstance: ganttInstance, ganttInitialized: true } );

        if( typeof props.ganttChartState.getValue().callbacks.onGanttInitialized === 'function' ) {
            props.ganttChartState.getValue().callbacks.onGanttInitialized( props.ganttChartState );
        }
    }

    return { ganttInstance: ganttInstance };
};

const attachEventCallbacks = ( ganttInstance, props ) => {
    let callbacks = props.ganttChartState.getValue().callbacks;
    ganttInstance.attachEvent( 'onBeforeGanttReady', () => initCustomizations( ganttInstance, props.ganttChartState ) );
    ganttInstance.attachEvent( 'onGanttReady', callbacks && callbacks.onGanttReady );
    ganttInstance.attachEvent( 'onMultiSelect', ( event ) => onMultiSelect( event, ganttInstance, props.selectionData, callbacks ) );
    ganttInstance.attachEvent( 'onLinkClick', ( id ) => onLinkClick( id, ganttInstance, props.selectionData, callbacks ) );
    ganttInstance.attachEvent( 'onScaleClick',  callbacks && callbacks.onClickToZoom );
    ganttInstance.attachEvent( 'onGanttScroll', callbacks && callbacks.onGanttScroll );
    ganttInstance.attachEvent( 'onBeforeLinkAdd', callbacks && callbacks.onBeforeLinkAdd );
    ganttInstance.attachEvent( 'onLinkDblClick', callbacks && callbacks.onLinkDblClick );
    ganttInstance.attachEvent( 'onBeforeTaskDrag', callbacks && callbacks.onBeforeTaskDrag );
    ganttInstance.attachEvent( 'onAfterTaskDrag', callbacks && callbacks.onAfterTaskDrag );
    ganttInstance.attachEvent( 'onTaskOpened', callbacks && callbacks.onTaskOpened );
    ganttInstance.attachEvent( 'onTaskClick', callbacks && callbacks.onTaskClick );
};

const initCustomizations = ( ganttInstance, ganttChartState ) => {
    if( !ganttChartState ) {
        return;
    }

    if( ganttChartState.getValue().ganttConfig ) {
        Object.assign( ganttInstance.config, ganttChartState.ganttConfig );
    }

    if( Array.isArray( ganttChartState.getValue().workTimes ) ) {
        ganttChartState.workTimes.forEach( workTime => ganttInstance.setWorkTime( workTime ) );
    }

    if( Array.isArray( ganttChartState.getValue().zoomLevels ) ) {
        ganttZoomService.initZoomLevels( ganttInstance, ganttChartState.getValue().zoomLevels );
        ganttChartState.getValue().zoomLevel && ganttInstance.ext.zoom.setLevel( ganttChartState.getValue().zoomLevel );
        ganttInstance.ext.zoom.attachEvent( 'onAfterZoom', ( level, config ) => onAfterZoom( level, config, ganttChartState, ganttInstance ) );
    }

    ganttChartState.getValue().callbacks && ganttChartState.getValue().callbacks.onBeforeGanttReady();
};

const addTodayMarker = ( ganttInstance ) => {
    let dateToStr = ganttInstance.date.date_to_str( ganttInstance.config.task_date );
    let markerId = ganttInstance.addMarker( {
        start_date: new Date(),
        css: 'today',
        text: ganttInstance.locale.labels.today,
        title: ganttInstance.locale.labels.today + ': ' + dateToStr( new Date() )
    } );
    setInterval( function() {
        if( ganttInstance ) {
            let todayMarker = ganttInstance.getMarker( markerId );
            if( todayMarker ) {
                todayMarker.start_date = new Date();
                todayMarker.title = ganttInstance.locale.labels.today + ': ' + dateToStr( todayMarker.start_date );
                ganttInstance.updateMarker( markerId );
            }
        }
    }, 1000 * 60 );
};

const onMultiSelect = ( event, ganttInstance, selectionData, callbacks ) => {
    ganttSelectionService.selectLink( null, ganttInstance );
    let selIds =  ganttSelectionService.updateSelectionData( ganttInstance.getSelectedTasks(), selectionData );
    let selectedUids = selIds.selectedUids;
    let previousSelectedUids = selIds.previousSelectedUids;

    if( selectedUids && callbacks && callbacks.onObjectsSelected ) {
        callbacks.onObjectsSelected( selectedUids, previousSelectedUids );
    }
};

const onLinkClick = ( id, ganttInstance, selectionData, callbacks ) => {
    ganttSelectionService.selectLink( id, ganttInstance );
    let selIds = ganttSelectionService.updateSelectionData( id ? [ id ] : [], selectionData );
    let selectedUids = selIds.selectedUids;
    let previousSelectedUids = selIds.previousSelectedUids;

    if( selectedUids && callbacks && callbacks.onObjectsSelected ) {
        callbacks.onObjectsSelected( selectedUids, previousSelectedUids );
    }
};

const onAfterZoom = ( level, config, ganttChartState, ganttInstance ) => {
    if( ganttChartState.getValue().zoomLevel !== config.name ) {
        ganttChartState.update( { ...ganttChartState.getValue(), zoomLevel: config.name } );
    }
    let parentTasks = [];
    ganttInstance.eachTask( ( ganttTask ) => {
        ganttInstance.hasChild( ganttTask.id ) && parentTasks.push( ganttTask );
    } );
    parentTasks.forEach( ( parentTask ) => {
        let childUids = ganttInstance.getChildren( parentTask.id );
        let childObjects = awGanttStackedService.getGanttTasksFromUids( childUids, ganttInstance, false );
        awGanttStackedService.calculateAndUpdateOffset( childObjects, ganttInstance );
        awGanttStackedService.updateStackedCount( childObjects, ganttInstance );
        ganttInstance.refreshData();
    } );
    let selectedId = ganttInstance.getLastSelectedTask();
    let selectedTask = selectedId ? ganttInstance.getTask( selectedId ) : null;
    let position = selectedTask ? ganttInstance.posFromDate( selectedTask.start_date ) : ganttInstance.posFromDate( ganttInstance.getSubtaskDates().start_date );
    ganttInstance.scrollTo( position - ganttInstance.config.min_column_width );
};

export const destroyGanttChart = ( ganttInstance ) => {
    console.log( 'AwGanttChartService destroyGanttChart' );

    if( ganttInstance ) {
        ganttInstance.destructor(); // Clean up the data and events from DHTMLX gantt instance.
    }
};

export const resetGanttData = ( ganttInstance, ganttData ) => {
    ganttInstance.clearAll();
    ganttInstance.parse( ganttData );
};

export const setWorkTimes = ( ganttInstance, workTimesArr ) => {
    if( ganttInstance ) {
        workTimesArr.forEach( workTime => ganttInstance.setWorkTime( workTime ) );
        ganttInstance.render();
    }
};
