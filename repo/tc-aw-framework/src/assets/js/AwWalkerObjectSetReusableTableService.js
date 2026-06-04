import AwSplmTable from 'viewmodel/AwSplmTableViewModel';
import AwCompare2 from 'viewmodel/AwCompare2ViewModel';
import columnArrangeService from 'js/columnArrangeService';
import { initDataProviderRef, getSortCriteria } from 'js/xrtUtilities';

var exports = {};

export const awWalkerObjectSetReusableTableRenderFunction = ( props ) => {
    const { viewModel, showCheckBox, selectionModel, selectionData, fields, isCompareTable, containerHeight, subPanelContext } = props;
    const gridId = 'ObjectSet_Provider';
    if( isCompareTable ) {
        return <AwCompare2 {...viewModel.grids[gridId]} reusable='true'></AwCompare2>;
    }
    let gridInfo = props.gridInfo || {};
    return <AwSplmTable {...viewModel.grids[gridId]} reusable='true' showContextMenu={true} showCheckBox={showCheckBox} selectionData={selectionData} selectionModel={selectionModel} commandContext={{ arrangeData: fields.arrangeData, subPanelContext: subPanelContext }}
        containerHeight={containerHeight} tableContext={{ columnsData: fields.columnsData, showCheckBox: fields.showCheckBox, isBulkEditing: fields.isBulkEditing,
            startEdit: fields.startEdit, cancelEdit: fields.cancelEdit, saveEdit: fields.saveEdit, selectRows: fields.selectRows }} enableArrangeMenu={gridInfo.enableArrangeMenu === true}> </AwSplmTable>;
};

export const loadColumns = function( props ) {
    let columnConfig = {
        columns: []
    };
    let columnInfos = [];
    if( props ) {
        let gridInfo = props.gridInfo || {};
        if ( props.columns ) {
            props.columns.forEach( ( column ) => {
                column.enableColumnHiding = gridInfo.enableArrangeMenu === true;
            } );
        }
        columnConfig = {
            columnConfigId: props.objectSetUri,
            columns: props.columns,
            operationType: props.operationType
        };
        columnInfos.push( columnConfig.columns );
    }
    let sortCriteria = getSortCriteria( props?.objectSetData, props?.columns );
    return {
        columnInfos: columnInfos[0],
        columnConfig: columnConfig,
        sortCriteria: sortCriteria
    };
};

export const initialize = ( dataProvider, columnProvider, dpRef, objectSetSource, objectSetUri ) => {
    if( dataProvider ) {
        if( objectSetSource ) {
            dataProvider.setValidSourceTypes( objectSetSource );
        }
        dataProvider.objectSetUri = objectSetUri;
        if( !dpRef ) {
            return;
        }
        initDataProviderRef( dpRef );
        dpRef.current.dataProviders.push( dataProvider.viewModelCollection.getLoadedViewModelObjects );

        dpRef.current.columnProviders[ dataProvider.name ] = {
            getColumnFilters: columnProvider.getColumnFilters,
            getSortCriteria: columnProvider.getSortCriteria,
            getColumns: columnProvider.getColumns
        };
    }
};

export const cleanup = ( dataProvider, dpRef ) => {
    if( dataProvider && dpRef.current && dpRef.current.dataProviders.includes( dataProvider.viewModelCollection.getLoadedViewModelObjects ) ) {
        let dpName = dataProvider.name;

        let index = dpRef.current.dataProviders.indexOf( dataProvider.viewModelCollection.getLoadedViewModelObjects );
        if( index > -1 ) {
            dpRef.current.dataProviders.splice( dataProvider.viewModelCollection.getLoadedViewModelObjects, 1 );
        }

        if( dpRef.current.columnProviders[ dpName ] ) {
            delete dpRef.current.columnProviders[ dpName ];
        }
    }
};

export const arrangeObjectSetColumns = ( eventData, viewModel, props ) => {
    if( eventData && eventData.objectSetUri === props?.objectSetUri || eventData.columnConfigId === props?.objectSetUri ) {
        eventData.props = props;
        columnArrangeService.arrangeColumns( viewModel, eventData );
    }
};

exports = {
    awWalkerObjectSetReusableTableRenderFunction,
    loadColumns,
    initialize,
    cleanup,
    arrangeObjectSetColumns
};

export default exports;
