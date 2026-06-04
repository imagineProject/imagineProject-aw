// Copyright (c) 2022 Siemens

const _levelMap = new Map();

export const initZoomLevels = ( ganttInstance, levelNames ) => { // Valid values are: ['year', 'quarter', 'month', 'week', 'day']
    var zoomConfig = {
        minColumnWidth: 80,
        maxColumnWidth: 150,
        levels: getLevels( ganttInstance, levelNames ),
        startDate: ganttInstance.start_date,
        endDate: ganttInstance.end_date,
        useKey: 'ctrlKey',
        trigger: 'wheel',
        element: function() {
            return ganttInstance.$root.querySelector( '.gantt_task' );
        }
    };

    ganttInstance.config.min_column_width = 80;
    ganttInstance.ext.zoom.init( zoomConfig );
};

const getLevels = ( ganttInstance, levelNames ) => {
    if( _levelMap.size === 0 ) {
        _levelMap.set( 'year', {
            name: 'year',
            scales: [
                { unit: 'year', step: 1, format: '%Y' }
            ]
        } );

        _levelMap.set( 'quarter', {
            name: 'quarter',
            scales: [
                { unit: 'year', step: 1, format: '%Y' },
                {
                    unit: 'quarter',
                    step: 1,
                    format: function( date ) {
                        let month = date.getMonth();
                        return 'Q' + ( month >= 9 ? 4 : month >= 6 ? 3 : month >= 3 ? 2 : 1 );
                    }
                }
            ]
        } );

        _levelMap.set( 'month', {
            name: 'month',
            scales: [
                { unit: 'year', step: 1, format: '%Y' },
                {
                    unit: 'quarter',
                    step: 1,
                    format: function( date ) {
                        let month = date.getMonth();
                        return 'Q' + ( month >= 9 ? 4 : month >= 6 ? 3 : month >= 3 ? 2 : 1 );
                    }
                },
                { unit: 'month', step: 1, format: '%M\' %y' }
            ]
        } );

        _levelMap.set( 'week', {
            name: 'week',
            scales: [
                { unit: 'year', step: 1, format: '%Y' },
                { unit: 'month', step: 1, format: '%F %Y' },
                {
                    unit: 'week',
                    step: 1,
                    format: function( date ) {
                        let dateToStr = ganttInstance.date.date_to_str( '%d' );
                        let weekNum = ganttInstance.date.date_to_str( '(%W)' );
                        let endDate = ganttInstance.date.add( ganttInstance.date.add( date, 1, 'week' ), -1, 'day' );
                        return dateToStr( date ) + '-' + dateToStr( endDate ) + ' ' + weekNum( date );
                    }
                }
            ]
        } );

        _levelMap.set( 'day', {
            name: 'day',
            scales: [
                { unit: 'month', step: 1, format: '%F %Y' },
                {
                    unit: 'week',
                    step: 1,
                    format: function( date ) {
                        let weekText = ganttInstance.locale.labels.weeks;
                        let dateToStr = ganttInstance.date.date_to_str( '%d %M' );
                        let weekNum = ganttInstance.date.date_to_str( '(' + weekText + ' %W)' );
                        let endDate = ganttInstance.date.add( ganttInstance.date.add( date, 1, 'week' ), -1, 'day' );
                        return dateToStr( date ) + ' - ' + dateToStr( endDate ) + ' ' + weekNum( date );
                    }
                },
                { unit: 'day', step: 1, format: '%d, %D' }
            ]
        } );
    }

    let levels = [];
    levelNames.forEach( level => levels.push( _levelMap.get( level ) ) );
    return levels;
};

export const setZoomLevel = ( ganttInstance, zoomLevel ) => {
    ganttInstance && ganttInstance.ext.zoom.setLevel( zoomLevel );
};

export default {
    initZoomLevels,
    setZoomLevel
};
