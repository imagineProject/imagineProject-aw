// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

export const buildKanbanColumns = ( awColumns ) => {
    let kanbanColumns = {};
    let groupColumns = {};
    let columnMapping = {};
    awColumns.forEach( function( col ) {
        if( col.name !== 'icon' ) {
            if( col.isGroup ) {
                kanbanColumns[ col.name ] = col;
            } else {
                if( col.groupID ) {
                    let columnInfo = groupColumns[ col.groupID ];

                    if( !columnInfo ) {
                        columnInfo = [];
                    }
                    columnInfo.push( col );

                    let groupCol = kanbanColumns[ col.groupID ];
                    columnMapping[ col.name ] = groupCol.groupName;
                    groupColumns[ col.groupID ] = columnInfo;
                } else {
                    kanbanColumns[ col.name ] = col;
                    columnMapping[ col.name ] = col.name;
                }
            }
        }
    } );

    let kanbanLanes = [];
    for( let colName in kanbanColumns ) {
        let col = kanbanColumns[ colName ];
        // kanbanColumns.forEach( function ( col ) {
        let lane = {};
        lane.header = col.displayName; //update display name
        let groupCols = groupColumns[ col.name ];
        if( groupCols ) {
            let length = groupCols.length;
            lane.body = {};
            lane.body.cols = [];
            groupCols.forEach( function( grpCol ) {
                let dispName = grpCol.displayName; //update display name
                let subLane = {
                    header: dispName,
                    body: {
                        status: grpCol.name,
                        multiselect: grpCol.multiselect,
                        view: 'kanbanlist',
                        type: 'cards',
                        minWidth: 250
                    }
                };
                lane.body.cols.push( subLane );
            } );
            lane.gravity = length;
            lane.body.type = 'wide';
        } else {
            lane.body = {
                status: col.name,
                view: 'kanbanlist',
                type: 'cards',
                multiselect: col.multiselect,
                minWidth: 250
            };
        }
        kanbanLanes.push( lane );
    }
    return { kanbanLanes: kanbanLanes, columnMapping: columnMapping };
};

let exports;
export default exports = {
    buildKanbanColumns
};
