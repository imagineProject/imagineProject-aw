// Copyright (c) 2022 Siemens

import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';

export const initOverrideVariables = ( ganttInstance ) => {
    ganttInstance[ 'criticalTaskUids' ] = {};
    ganttInstance[ 'showGanttTaskInfo' ] = appCtxSvc.getCtx( 'showGanttTaskInfo' );

    //Convenient objects/functions for handling baselines
    ganttInstance[ 'baselineUids' ] = [];
    ganttInstance[ 'baselineTaskLayerId' ] = undefined;
    ganttInstance[ 'baselineInfo' ] = {};
    ganttInstance[ 'getBaselineTaskInfo' ] = ( baselineUid, ganttTask ) => {
        return _.get( ganttInstance, [ 'baselineInfo', baselineUid, ganttTask.uid ], {} );
    };
};

export const addScheduleGanttOverrides = ( ganttInstance ) => {
    ganttInstance.isCriticalTask = function( task ) {
        return this.criticalTaskUids && this.criticalTaskUids[ task.uid ];
    };

    ganttInstance.isCriticalLink = function( link ) {
        return this.criticalTaskUids && this.criticalTaskUids[ link.source ] && this.criticalTaskUids[ link.target ];
    };

    ganttInstance.attachEvent( 'onBeforeTaskDisplay', function( id, task ) {
        return !task.rollup;
    } );

    ganttInstance.resetProjectDates = function( t ) {
        var i = n( t );
        if( i.$no_end || i.$no_start || t.type === '6' ) {
            var r = a( t.id );
            ( function( t, n, i, r ) {
                n.$no_start &&
                        ( t.start_date = i ? new Date( i ) : e( t, this.getParent( t ) ) );
                n.$no_end &&
                        ( t.end_date = r ?
                            new Date( r ) :
                            this.calculateEndDate( {
                                start_date: t.start_date,
                                duration: ganttInstance.config
                                    .duration_step,
                                task: t
                            } ) );
                ( n.$no_start || n.$no_end ) &&
                    ganttInstance._init_task_timing( t );
            }.call( this, t, i, r.start_date, r.end_date ),
            t.$rollup = r.rollup  );
        }
    };
    var e = function( e, n ) {
        var i = !( !n || n === ganttInstance.config.root_id ) && ganttInstance.getTask( n );
        var r = null;
        if( i ) {
            r = ganttInstance.config.schedule_from_end ? ganttInstance.calculateEndDate( {
                start_date: i.end_date,
                duration: -ganttInstance.config.duration_step,
                task: e
            } ) : i.start_date;
        } else if( ganttInstance.config.schedule_from_end ) {
            r = ganttInstance.calculateEndDate( {
                start_date: ganttInstance._getProjectEnd(),
                duration: -ganttInstance.config.duration_step,
                task: e
            } );
        } else {
            var a = ganttInstance.getTaskByIndex( 0 );
            r = a ? a.start_date ? a.start_date : a.end_date ? ganttInstance.calculateEndDate( {
                start_date: a.end_date,
                duration: -ganttInstance.config.duration_step,
                task: e
            } ) : null : ganttInstance.config.start_date || ganttInstance.getState().min_date;
        }
        return ganttInstance.assert( r, 'Invalid dates' ),
        new Date( r );
    };
    var n = function( e, n ) {
        var i = ganttInstance.getTaskType( e.type );
        var r = {
            type: i,
            $no_start: !1,
            $no_end: !1
        };
        return n || i !== e.$rendered_type ? ( i === ganttInstance.config.types.project ? r.$no_end = r.$no_start = !0 : i !== ganttInstance.config.types.milestone &&
            ( r.$no_end = !( e.end_date || e.duration ),
            r.$no_start = !e.start_date,
            ganttInstance._isAllowedUnscheduledTask( e ) && ( r.$no_end = r.$no_start = !1 ) ),
        r ) : ( r.$no_start = e.$no_start,
        r.$no_end = e.$no_end,
        r );
    };

    function a( e ) {
        var n = null;
        var i = null;
        var r = void 0 !== e ? e : ganttInstance.config.root_id;
        var a = [];
        return ganttInstance.eachTask( function( e ) {
            ganttInstance.getTaskType( e.type ) === ganttInstance.config.types.project || ganttInstance.isUnscheduledTask( e ) || e.type === '6' ||
                ( e.rollup && a.push( e.id ),
                e.start_date && !e.$no_start && ( !n || n > e.start_date.valueOf() ) && ( n = e.start_date.valueOf() ),
                e.end_date && !e.$no_end && ( !i || i < e.end_date.valueOf() ) && ( i = e.end_date.valueOf() ) );
        }, r ), {
            start_date: n ? new Date( n ) : null,
            end_date: i ? new Date( i ) : null,
            rollup: a
        };
    }
};

export default {
    initOverrideVariables,
    addScheduleGanttOverrides
};
