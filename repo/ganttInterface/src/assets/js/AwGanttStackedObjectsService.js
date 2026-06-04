// Copyright (c) 2022 Siemens

import awGanttConstants from 'js/AwGanttConstants';
import awPromiseService from 'js/awPromiseService';
import popupSvc from 'js/popupService';

let padding = 0;
let dummyElementContext;

export let getExpectedOffsetForZoomLevel = ( ganttInstance ) => {
    let zoomLevel = ganttInstance.getScale().unit;
    let offset = 0;
    switch ( zoomLevel ) {
        case 'day':
            offset = awGanttConstants.GANTT_STACKED_EVENT_ZOOMLEVEL_OFFSETS.DAY;
            break;
        case 'week':
            offset = awGanttConstants.GANTT_STACKED_EVENT_ZOOMLEVEL_OFFSETS.WEEK;
            break;
        case 'month':
            offset = awGanttConstants.GANTT_STACKED_EVENT_ZOOMLEVEL_OFFSETS.MONTH;
            break;
        case 'quarter':
            offset = awGanttConstants.GANTT_STACKED_EVENT_ZOOMLEVEL_OFFSETS.QUARTER;
            break;
        case 'year':
            offset = awGanttConstants.GANTT_STACKED_EVENT_ZOOMLEVEL_OFFSETS.YEAR;
            break;
    }
    return offset;
};

export const updateStackedCount = ( objects, ganttInstance ) => {
    let index = 0;
    let stackedObjectsCount = 1;
    let uidList = [];
    let offsetForZoomLevel = getExpectedOffsetForZoomLevel( ganttInstance );
    while( index < objects.length ) {
        let object = objects[ index ];
        object.setStackedObjectsUids( [ object.id ] );
        //till offset is less than offset for zoom, keep adding the uid to uidList and add the stackedCount
        if( object.offset <= offsetForZoomLevel && index < objects.length - 1 ) {
            stackedObjectsCount++;
            uidList.push( object.id );
        } else {
            //For last element, set the stackedUids blindly as last one should have the value
            uidList.push( object.id );
            object.setStackedObjectsUids( uidList );
            stackedObjectsCount = 1;
            uidList = [];
        }
        index++;
    }
};

export const calculateAndUpdateOffset = ( objects, ganttInstance ) => {
    if( objects.length === 1 ) {
        objects[ 0 ].showLeftText = true;
        objects[ 0 ].showRightText = true;
    } else if( objects.length > 1 ) {
        objects.sort( ( object1, object2 ) => object1.start_date.getTime() >= object2.start_date.getTime() ? 1 : -1 );
        for( let index = 1; index < objects.length; index++ ) {
            let object = objects[ index ];
            let prevObject = objects[ index - 1 ];
            let offset = ( object.start_date.getTime() - prevObject.start_date.getTime() ) / awGanttConstants.GANTT_MILLISECONDS_IN_HOUR; //in hours
            prevObject.offset = offset;
            updateEventInfoFlag( object, prevObject, ganttInstance );
        }
        objects[ 0 ].showLeftText = true;
        objects[ objects.length - 1 ].showRightText = true;
    }
};

const updateEventInfoFlag = ( object, prevObject, ganttInstance ) => {
    object.showLeftText = false;
    prevObject.showRightText = false;
    if( !prevObject ) {
        object.showLeftText = true;
    }
    if( !dummyElementContext ) {
        let element = document.createElement( 'canvas' );
        dummyElementContext = element.getContext( '2d' );
        let eventFontSize = window.getComputedStyle( document.getElementsByClassName( 'aw-splm-tableCellText' )[ 0 ] ).fontSize;
        let eventFontFamily = window.getComputedStyle( document.getElementsByClassName( 'aw-splm-tableCellText' )[ 0 ] ).fontFamily;
        dummyElementContext.font = eventFontSize + ' ' + eventFontFamily;
    }
    let leftText = object.getLeftSideValue( object.start_date, object.end_date, object, ganttInstance );
    let leftTextSize = 0;
    if( !ganttInstance.isCurrentZoomLevel( 'day' ) ) {
        leftTextSize = dummyElementContext.measureText( leftText ).width;
    }
    let prevRightText = prevObject.getRightSideValue( prevObject.start_date, prevObject.end_date, prevObject, ganttInstance );
    let prevRightTextSize = dummyElementContext.measureText( prevRightText ).width;
    let objectPosition = ganttInstance.getTaskPosition( object );
    let prevObjectPosition = ganttInstance.getTaskPosition( prevObject );
    let width = 23; //milestone width including border
    if( !padding ) {
        padding = getStylingForGanttSideContent();
    }
    let totalDistance = objectPosition.left - ( prevObjectPosition.left + width + padding ); //distance between cur & next event
    //Case1: Both (previous right and current left ) can fit
    if( totalDistance >= leftTextSize + prevRightTextSize ) {
        object.showLeftText = true;
        prevObject.showRightText = true;
    }
    //Case2 : Only Previous right can fit
    else if( leftTextSize > prevRightTextSize && totalDistance >= leftTextSize ) {
        object.showLeftText = true;
        prevObject.showRightText = false;
    }
    //Case3: Only current left can fit
    else if( prevRightTextSize > leftTextSize && totalDistance >= prevRightTextSize ) {
        object.showLeftText = false;
        prevObject.showRightText = true;
    }
};

let getStylingForGanttSideContent = () => {
    const outerLeft = document.createElement( 'div' );
    outerLeft.className = 'gantt_side_content gantt_left';
    outerLeft.style.visibility = 'hidden';
    document.body.appendChild( outerLeft );
    let leftStyling = window.getComputedStyle( outerLeft );

    const outerRight = document.createElement( 'div' );
    outerRight.className = 'gantt_side_content gantt_right';
    outerRight.style.visibility = 'hidden';
    document.body.appendChild( outerRight );
    let rightStyling = window.getComputedStyle( outerRight );
    let paddingSize = parseInt( leftStyling.paddingRight, 10 ) + parseInt( leftStyling.marginRight, 10 ) +
    parseInt( rightStyling.paddingLeft, 10 ) + parseInt( rightStyling.marginLeft, 10 );
    //After calculating all padding, remove added div element as it was just added for calculation.
    document.body.removeChild( outerLeft );
    document.body.removeChild( outerRight );
    return paddingSize;
};

export const getParentChildMapForParent = ( parentUids, ganttInstance, skipValidation ) => {
    let parentChildMap = {};
    parentUids && parentUids.forEach( parentUid => {
        if( ganttInstance.isTaskExists( parentUid ) ) {
            let parentTask = ganttInstance.getTask( parentUid );
            if( parentTask && !parentChildMap[ parentUid ] ) {
                updateParentChildMap( parentUid, parentChildMap, ganttInstance, skipValidation );
            }
        }
    } );
    return parentChildMap;
};

export const getParentChildMap = ( taskUidList, ganttInstance, skipValidation ) => {
    let parentChildMap = {};
    taskUidList && taskUidList.forEach( uid => {
        if( ganttInstance.isTaskExists( uid ) ) {
            let task = ganttInstance.getTask( uid );
            if( task && !parentChildMap[ task.parent ] ) {
                updateParentChildMap( task.parent, parentChildMap, ganttInstance, skipValidation );
            }
        }
    } );
    return parentChildMap;
};

const updateParentChildMap = ( parentUid, parentChildMap, ganttInstance, skipValidation ) => {
    let childUids = ganttInstance.getChildren( parentUid );
    let childObjects = getGanttTasksFromUids( childUids, ganttInstance, skipValidation );
    parentChildMap[ parentUid ] = childObjects;
};

export const getGanttTasksFromUids = ( uidList, ganttInstance, skipValidation ) => {
    let objects = [];
    uidList.map( ( uid ) => {
        let ganttObject = ganttInstance.isTaskExists( uid ) && ganttInstance.getTask( uid );
        if( ganttObject && ( skipValidation || ganttObject.isBubbleCountSupported() ) ) {
            objects.push( ganttObject );
        }
    } );
    return objects;
};

export let openStackedPopupPanel = ( stackedUids, ganttInstance, selectedObjectUid, refTask ) => {
    let options = {
        reference: refTask,
        // targetEvent: event
        detachMode: true,
        resizeToClose: true,
        whenParentScrolls: 'close',
        placement: 'right-start',
        hasArrow: true,
        arrowOptions: {
            alignment: 'center',
            shift: 5
        },
        width: 250,
        subPanelContext: {
            stackedUids: stackedUids,
            selectionMode: ganttInstance.config.multiselect ? 'multiple' : 'single',
            selectedObjectUid: selectedObjectUid
        }
    };
    let deferred = awPromiseService.instance.defer();
    let data = {
        declView: 'AwGanttStackedPopup',
        options: options
    };
    popupSvc.show( data ).then( function( popupRef ) {
        let _popupRef = popupRef;
        deferred.resolve( popupRef );
    } );

    return deferred.promise;
};

const exports = {
    getExpectedOffsetForZoomLevel,
    updateStackedCount,
    calculateAndUpdateOffset,
    getParentChildMap,
    getParentChildMapForParent,
    getGanttTasksFromUids,
    openStackedPopupPanel
};

export default exports;
