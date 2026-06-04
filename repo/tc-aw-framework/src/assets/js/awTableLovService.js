import awColumnSvc from 'js/awColumnService';
import modelPropertyService from 'js/modelPropertyService';
import _ from 'lodash';
import highlighterSvc from 'js/highlighterService';
import AwLovData from 'js/AwLovData';
import eventBus from 'js/eventBus';
import viewModelObjectService from 'js/viewModelObjectService';
import uwPropertyService from 'js/uwPropertyService';

let _lovTableColumns = null;
let _lovData = null;
const COMP_NAME = 'lovTable';

export const setSelectedRow = ( onMountCodefulSelection, selectionModel, selectedObject ) => {
    selectionModel.setSelection( selectedObject.selectedRow );
    if( onMountCodefulSelection === false ) {
        return !onMountCodefulSelection;
    }
    return onMountCodefulSelection;
};

export const reloadDataProvider = ( subPanelContext, dataProvider, lovOpened, viewModel ) => {
    let isLinkFocusable =  viewModel.conditions.focusLink === true;
    let linkVisibility = viewModel.conditions.showSuggestionLink;
    //no need to fire dataProvider action when no filtering is present on mount
    if( !subPanelContext.filterString && lovOpened.value === false ) {
        lovOpened.update( true );
        return false;
    }
    dataProvider.resetDataProvider();
};

export const updateRowAttention = ( subPanelContext, viewModel ) => {
    let isLinkFocusable =  viewModel.conditions.focusLink === true;
    let linkVisibility = viewModel.conditions.showSuggestionLink;
    if( linkVisibility && isLinkFocusable && subPanelContext.filterString === null ) {
        return;
    }
    if( linkVisibility && isLinkFocusable && subPanelContext.suggLinkAttn.current !== true ) {
        subPanelContext.updateSuggLinkAttn( true );
    }
    eventBus.publish( 'lovTableProvier.plTable.clientRefresh' );
};

export const updateDataProviderEntries = ( tableRows, updateSelectionData ) => {
    let selectedRow = updateSelectionData( tableRows );
    return { selectedRow };
};

export const commitValue = ( setLovEntry, dataProvider, onMountCodefulSelection ) => {
    let selectedObject = dataProvider.getSelectedObjects()[0];
    if( !onMountCodefulSelection && !_.isNil( selectedObject ) ) {
        setLovEntry( selectedObject );
    }
    if( onMountCodefulSelection === true ) {
        return !onMountCodefulSelection;
    }

    return onMountCodefulSelection;
};

export const updateSelectedObject = ( selectionModel, selectedObject ) => {
    //TODO zwnx0r :to check with Mihir in followup changes
};

export const getViewModelRows = ( response, dataprovider, filtering, subPanelContext ) => {
    _lovData = new AwLovData( response );
    _lovData.processIntialLovReponse();

    let type = _lovData.getLovType();
    let lovCols = _lovData.getLovColumns();
    let lovRows = _lovData.getLovRows();

    filtering = _.isEmpty( filtering ) ? '' : filtering;
    highlighterSvc.highlightKeywords( [ filtering ] );

    let cols = getLOVTableColumns( lovCols );
    let row = 0;
    let tableRows = lovRows.map( ( lovRow ) => {
        let uid = _.isEmpty( lovRow.uid ) ?  row++ :  lovRow.uid;
        let vmRow = _createVMObject( lovRow, uid, type, lovCols );

        vmRow.propDisplayValue = _lovData.getRowDisplValue( lovRow );
        vmRow.propInternalValue = _lovData.getRowInternalValue( lovRow );

        return vmRow;
    } );

    if ( _.isNil( dataprovider.columnConfig?.columns ) || dataprovider.columnConfig?.columns?.length !== cols.length )  {
        dataprovider.columnConfig = {
            columns: cols
        };
    }
    let moreValuesExist = response?.moreValuesExist;
    if( tableRows && tableRows.length > 0 ) {
        tableRows[tableRows.length - 1].incompleteTail = moreValuesExist;
    }
    dataprovider.cursorObject = {
        endReached: !moreValuesExist
    };
    if( tableRows.length === 0 && _lovData.lovUsage === 2 ) {
        subPanelContext.updateSuggLinkAttn( true );
    }

    let responseLovData = response?.lovData;

    return {
        lovTableData: tableRows,
        cols,
        lovData: responseLovData,
        lovUsage: _lovData.lovUsage
    };
};

export const getSortOrder = ( sortCriteria ) => {
    if ( !_.isNil( sortCriteria ) && sortCriteria.length > 0 && sortCriteria[0].sortDirection === 'DESC' ) {
        return 2;
    }
    return 1;
};

const _createVMObject = ( lovRow, rowID, modelType, columns ) => {
    let vmRow = viewModelObjectService.constructViewModelObject( lovRow );
    vmRow.uid = vmRow.uid || rowID;
    vmRow.id = vmRow.id || rowID;
    vmRow.modelType = vmRow.modelType || modelType;
    vmRow.props = vmRow.props || {};
    vmRow.lovRowValue = {
        uid: vmRow.uid
    };
    //add props on columns for each vmo row
    for ( let column of columns ) {
        vmRow.props[ column.getInternalName() ] =  _createVMP(  modelType, column, lovRow );
    }
    return vmRow;
};

const _createVMP = ( type, propData, lovRow )=>{
    let vmp = {
        displayName: propData.getDispName(),
        propName: propData.getInternalName(),
        type: type,
        isRequired: false,
        isEditable: false,
        dbValue: _lovData.getPropInternalValue( lovRow, propData  ),
        dispValue: _lovData.getPropDispValue( lovRow, propData  ),
        maxLength: 1
    };

    vmp = modelPropertyService.createViewModelProperty( vmp );
    return vmp;
};


export const getLOVTableColumns = ( lovColumns ) => {
    let columns = _lovTableColumns;
    if( columns === null ) {
        columns = _getLovTableColumnInfos( lovColumns );
    }
    return columns;
};

export const processPropertyName = ( propertyName ) => {
    return uwPropertyService.getBasePropertyName( propertyName );
};

export const getPropertyValuesForLOV = function( subPanelContext, dataProvider ) {
    const vmProperty = subPanelContext.vmo.props[subPanelContext.propertyName];
    const propertyValues = {};
    const selectedObject = dataProvider.getSelectedObjects()[0];
    const uiValueToUpdate = selectedObject.propDisplayValue;
    const dbValueToUpdate = selectedObject.propInternalValue;
    propertyValues[ subPanelContext.propertyName ] = [ dbValueToUpdate ];
    return propertyValues;
};

const _getLovTableColumnInfos = ( lovColumns ) => {
    let awColumnInfos = [];


    for ( let lovCol of lovColumns ) {
        let awColumnInfo = awColumnSvc.createColumnInfo( {
            name: lovCol.getInternalName(),
            propertyName: lovCol.getInternalName(),
            displayName: lovCol.getDispName(),
            width: 150,
            minWidth: 70,
            typeName: 'String',
            enableColumnResizing: true,
            enableColumnHiding: false
        } );
        awColumnInfos.push( awColumnInfo );
    }
    return awColumnInfos;
};

export const decideBOName = ( subPanelContext ) => {
    const vmo = subPanelContext?.vmo;
    // Check if vmo.props has any key starting with 'REF' and has renderingHint as 'lovTable'
    let refKey = Object.keys( vmo.props ).find( key =>
        key.startsWith( 'REF' ) &&
    vmo.props[key].renderingHint === COMP_NAME
    );
    //usecase: user has attached dynamic LOV to a revision and trying to use it on createInput
    if ( refKey ) {
    // Extract the value after 'revision, ' from the REF key itself
        let revisionMatch = refKey.match( /revision,\s*([^)]+)/ );
        return revisionMatch ? revisionMatch[1] : null;
    } else if( vmo.type ) {
        // Fallback to type name if no REF key found
        return vmo.type;
    }
    return null;
};
