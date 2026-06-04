// Copyright (c) 2022 Siemens

export const initSampleData = ( atomicDataRef ) => {
    const sampleData = {
        data: [
            { id: "10", text: "Project #1", start_date: "01-04-2019:02:00", duration: 3, order: 10, progress: 0.4, open: true },
            { id: "1", text: "Task #1", start_date: "02-04-2019:08:00", duration: 2, order: 10, progress: 0.6, parent: "10" },
            { id: "2", text: "Task #2", start_date: "01-04-2019:10:35", duration: 2, order: 20, progress: 0.6, parent: "10" },
            { id: "20", text: "Project #2", start_date: "01-04-2019:08:00", duration: 3, order: 10, progress: 0.4, type: "project", open: true },
            { id: "3", text: "Task #3", start_date: "02-04-2019", duration: 2, order: 10, progress: 0.6, parent: "20" },
            { id: "4", text: "Task #4", start_date: "01-04-2019", duration: 2, order: 20, progress: 0.6, parent: "20" }
        ],
        links: [
            { id: 1, source: 1, target: 2, type: "1" },
            { id: 2, source: 2, target: 3, type: "0" },
            { id: 3, source: 3, target: 4, type: "0" }
        ]
    };

    // Update atomic data
    atomicDataRef.ganttChartState.setAtomicData( { ...atomicDataRef.ganttChartState.getAtomicData(), initData : sampleData } );

    return {
        isDataInited: true,
        sampleJsonData: JSON.stringify( sampleData, null, '  ' )
    };
};

export const setGanttData = ( atomicDataRef, jsonData ) => {
    atomicDataRef.ganttChartState.setAtomicData( { ...atomicDataRef.ganttChartState.getAtomicData(), initData : JSON.parse( jsonData ) } );
};
