import AwSplmTable from 'viewmodel/AwSplmTableViewModel';
import viewModelObjectService from 'js/viewModelObjectService';
import tcDataMgmtSvc from 'js/tcDataManagementService';
import appCtxService from 'js/appCtxService';
import soa_kernel_propertyPolicyService from 'soa/kernel/propertyPolicyService';
import filtrPanelSrvc from 'js/filterPanelService';
import { getSelectedFiltersMap } from 'js/awSearchSublocationService';
import searchFilterService from 'js/aw.searchFilter.service';
import searchFolderService from 'js/searchFolderService';
import reportsCommSrvc from 'js/reportsCommonService';
import cmm from 'soa/kernel/clientMetaModel';
import _ from 'lodash';
import dmSvc from 'soa/dataManagementService';
import cdm from 'soa/kernel/clientDataModel';
import listBoxService from 'js/listBoxService';
import { AwServerVisibilityToolbar } from 'js/AwServerVisibilityCommandBarService';
import { ExistWhen } from 'js/hocCollection';
import editHandlerSvc from 'js/editHandlerService';
import localeSvc from 'js/localeService';
import eventBus from 'js/eventBus';
import awColumnService from 'js/awColumnService';

var exports = {};
const AwServerVisibilityToolbarExistWhen = ExistWhen( AwServerVisibilityToolbar );
const reportsLocation = 'com.siemens.splm.reports:createReportTemplate';
export const awReportTableServiceRenderFunction = ( props ) => {
    let { viewModel, subPanelContext, fields } = props;
    let { grids, ctx } = viewModel;

    if ( !subPanelContext ) {
        return null;
    }

    let tableContainerClass = subPanelContext.fullScreenState && subPanelContext.fullScreenState?.value !== true
        ? 'sw-row aw-report-tableContainer'
        : 'sw-row aw-report-tableContainerFullScreen';

    let contextObj = {
        ...subPanelContext,
        providerName: callRepGetProviderName( subPanelContext.reportsState ),
        searchCriteria: callRepGetSearchCriteria( subPanelContext.reportsState ),
        searchFilterMap: getSearchFilterMap( subPanelContext.reportsState ),
        columns: viewModel.dataProviders.rb0ActiveReportDataProvider.columnConfig?.columns,
        searchSortCriteria: getSearchSortCriteria( viewModel ),
        dataprovider: grids.rb0ActiveReportTable?.dataProviderInstance,
        columnProvider: grids.rb0ActiveReportTable?.columnProviderInstance,
        objectSetState: subPanelContext.reportsState,
        showCheckBox: fields.showCheckBox,
        gridContextPlaceholder: grids.rb0ActiveReportTable?.gridContextPlaceholder,
        editContext: grids.rb0ActiveReportTable?.dataProviderInstance?.json?.editContext,
        editContextObj: editHandlerSvc.getEditHandler( grids.rb0ActiveReportTable?.dataProviderInstance?.json?.editContext )
    };

    return (
        <div className='h-12'>
            <AwServerVisibilityToolbarExistWhen
                existWhen={subPanelContext.fullScreenState && subPanelContext.fullScreenState?.value !== true}
                firstAnchor='Rb0ReportingTableCommands'
                secondAnchor='Rb0ReportingTableCommands_right'
                reverseSecond
                orientation='HORIZONTAL'
                context={contextObj}
                mselected={ctx.mselected}
            />
            <div className={tableContainerClass}>
                <AwSplmTable
                    gridid={'rb0ActiveReportTable'}
                    showCheckBox={fields.showCheckBox?.value}
                    tableContext={{ showCheckBox: fields.showCheckBox }}
                    {...grids.rb0ActiveReportTable}
                />
            </div>
        </div>
    );
};

var getSearchSortCriteria = ( data ) => {
    if( data.columnProviders.staticColumnProvider?.sortCriteria?.length > 0 && data.dataProviders.rb0ActiveReportDataProvider.columnConfig?.columns ) {
        var propName = data.columnProviders.staticColumnProvider?.sortCriteria[0].fieldName;
        var dataColumns = data.dataProviders.rb0ActiveReportDataProvider.columnConfig.columns;
        var selColumn = dataColumns.filter( function( column ) {
            return column.name === propName;
        } );
        var fieldName = selColumn.length > 0 ? selColumn[ 0 ].associatedTypeName + '.' + propName : propName;
        data.columnProviders.staticColumnProvider.sortCriteria[0].fieldName = fieldName;
        return data.columnProviders.staticColumnProvider.sortCriteria;
    }
    return [];
};

var getSearchFilterMap = ( reportsState ) => {
    var activeFilters;
    if( !( appCtxService.ctx.state.params.filter && appCtxService.ctx.sublocation.nameToken === reportsLocation ) ) {
        activeFilters = reportsState.reportParameters?.ReportDefProps?.ReportSearchInfo?.activeFilterMap;
    } else {
        activeFilters = searchFilterService.getFilters();
        const selectedFiltersInfo = searchFilterService.buildSearchFiltersFromSearchState( activeFilters );
        activeFilters = selectedFiltersInfo.activeFilterMap;
    }
    if( activeFilters && reportsState.runtimeInfo && reportsState.runtimeInfo.appliedFilters ) {
        for( var key in reportsState.runtimeInfo.appliedFilters ) {
            activeFilters[key] = reportsState.runtimeInfo.appliedFilters[key];
        }
    }
    return activeFilters;
};

var getColumnFilters = ( data ) =>{
    if( data.grids.rb0ActiveReportTable.columnProviderInstance?.columnFilters ) {
        return data.grids.rb0ActiveReportTable.columnProviderInstance?.columnFilters;
    }
};

const getSourceObjectUid = ( reportsState )=> {
    let ctx = appCtxService.getCtx( '' );
    if( ctx.sublocation.nameToken === reportsLocation && reportsState.rootClassSampleObject?.length > 0 ) {
        return reportsState.rootClassSampleObject[0].uid;
    } else if( ctx.sublocation.nameToken === reportsLocation && reportsState.reportParameters.ReportDefProps.ReportClassParameters ) {
        return reportsState.reportParameters.ReportDefProps.ReportClassParameters.rootSampleUid;
    } else if( ctx.state.params.referenceId ) {
        return ctx.state.params.referenceId;
    } else if( reportsState.reportSourceObjectUid ) {
        return reportsState.reportSourceObjectUid;
    } else if( ctx.selected ) {
        var selected = reportsCommSrvc.getUnderlyingObject( ctx.selected );
        return selected.uid;
    }
    return null;
};

const getSourceObjectTraversalPath = function( reportsState ) {
    if( reportsState.reportParameters?.ReportDefProps?.ReportSearchInfo ) {
        return reportsState.reportParameters.ReportDefProps.ReportSearchInfo.SearchCriteria;
    }
    return '';
};

/**
  *
  * @function callRepGetSearchCriteria
  * @param {Object} reportsState - reportsState
  * @param {boolean} isFilterMapRequired - Indicates if the filter map is required.
  * @return {Object} additional search criteria to perform search
  */
export let callRepGetSearchCriteria = function( reportsState, isFilterMapRequired ) {
    var searchCriteria = {};

    if( reportsState.selectedReport && reportsState.selectedReport.props.rd_type.dbValues[0] === '1' || appCtxService.ctx.state.params.reportType === '1' ) {
        searchCriteria = {
            sourceObject: getSourceObjectUid( reportsState ),
            relationsPath: getSourceObjectTraversalPath( reportsState )
        };
    } else if( appCtxService.ctx.state.params.searchCriteria ) {
        searchCriteria = { searchString: appCtxService.ctx.state.params.searchCriteria, hideUnassignedCategories: 'false', limitedFilterCategoriesEnabled: false };
    } else if( reportsState.reportParameters.ReportDefProps?.ReportSearchInfo?.SearchCriteria ) {
        searchCriteria = { searchString: reportsState.reportParameters.ReportDefProps.ReportSearchInfo.SearchCriteria, hideUnassignedCategories: 'false', limitedFilterCategoriesEnabled:false };
    }
    var reportSearchInfo = reportsState.reportParameters.ReportDefProps?.ReportSearchInfo;
    if( appCtxService.ctx.state.params.additionalSearchCriteria ) {
        reportSearchInfo = { additionalSearchCriteria: JSON.parse( appCtxService.ctx.state.params.additionalSearchCriteria ) };
    }
    // Iterate for all entries in additional search criteria and add to main search criteria
    for( var searchCriteriaKey in reportSearchInfo?.additionalSearchCriteria ) {
        if( searchCriteriaKey !== 'SearchCriteria' && searchCriteriaKey !== 'activeFilterMap' ) {
            searchCriteria[ searchCriteriaKey ] = reportSearchInfo.additionalSearchCriteria[ searchCriteriaKey ];
        }
    }
    if( !isFilterMapRequired ) {
        isFilterMapRequired = 'true';
        if( reportsState.getValue().selectedAdvanedQuery && reportsState.getValue().searchInfo ) {
            isFilterMapRequired = 'false';
        }
        searchCriteria = { ...searchCriteria, isFilterMapRequired };
    }

    //add props for props specific search
    if( searchCriteria.searchString ) {
        let reportTranslatedSearchCriteria = reportsState.searchTraslatedCriteria ? _.cloneDeep( reportsState.searchTraslatedCriteria ) : [];
        reportTranslatedSearchCriteria.unshift( searchCriteria.searchString );
        searchFolderService.setPropsForPropertySpecificSearch( reportTranslatedSearchCriteria, searchCriteria );
    }

    return searchCriteria;
};

/**
  *
  * @function callRepGetProviderName
  * @param {Object} reportsState - reportsState
  * @return {Object} data provider name
  */
export let callRepGetProviderName = function( reportsState ) {
    if ( reportsState?.reportParameters?.ReportDefProps?.ReportSearchInfo?.dataProviderName ) {
        return reportsState.reportParameters.ReportDefProps.ReportSearchInfo.dataProviderName;
    }else if( reportsState?.selectedReport && reportsState.selectedReport.props.rd_type.dbValues[0] === '1' || appCtxService.ctx.state.params.reportType === '1' ) {
        return 'Rb0ReportsDataProvider';
    } else if( appCtxService.ctx.state.params.dataProvider ) {
        return appCtxService.ctx.state.params.dataProvider;
    }
    return 'Awp0FullTextSearchProvider';
};

var attributesToInflate = ( displayColumns )=>{
    var attributes = [];
    if( displayColumns ) {
        _.forEach( displayColumns, function( displayColumn ) {
            displayColumn.propertyName ? attributes.push( displayColumn.propertyName ) : '';
        } );
    }
    return attributes;
};

var getSearchInput = ( reportsState, data ) => {
    return {
        attributesToInflate: attributesToInflate( data.displayColumns ),
        internalPropertyName: '',
        maxToLoad: 50,
        maxToReturn: 50,
        providerName: callRepGetProviderName( reportsState ), //assign provider
        searchCriteria: callRepGetSearchCriteria( reportsState ), //assign the search criteria
        searchFilterFieldSortType: 'Priority',
        cursor: {
            startIndex: data.dataProviders.rb0ActiveReportDataProvider.startIndex //startIndex based on the cursor for the report table
        },
        columnFilters: getColumnFilters( data ),
        searchFilterMap6: getSearchFilterMap( reportsState ),
        searchSortCriteria: getSearchSortCriteria( data ) //check if any sort criteria exist
    };
};

/**
  * Register the policy
  * @param {Object} reportDefs - The report definitions.
  * @returns {any} policyId
  */
var registerPolicy = function( reportDefs ) {
    var types = {};
    var typeList = [ {
        name:'WorkspaceObject',
        properties:[ { name:'object_string' }, { name:'creation_date' } ]
    } ];
    if( reportDefs && reportDefs.ReportTable1 ) {
        var propList = reportDefs.ReportTable1.ColumnPropInternalName;
        for( var x = 0; x < propList.length; x++ ) {
            var propAndObj = propList[ x ].split( '.' );
            var typePropList = {};
            typePropList.name = propAndObj[ 0 ];
            var prop = {};
            prop.name = propAndObj[ 1 ];
            typePropList.properties = [ prop ];
            typeList.push( typePropList );
        }
        types.types = typeList;
        return soa_kernel_propertyPolicyService.register( types );
    }
};

export let callRepGetCategories = function( response, nwReportsState ) {
    var categories = response.searchFilterCategories;
    var categoryValues = response.searchFilterMap;
    var groupByProperty = response.objectsGroupedByProperty.internalPropertyName;
    var searchResultFilters = [];
    categories.refineCategories = [];
    categories.navigateCategories = [];
    var contextObject = nwReportsState.searchIncontextInfo;
    if( contextObject === undefined ) { contextObject = {}; }
    _.forEach( categories, function( category, index ) {
        filtrPanelSrvc.getCategories2Int( category, index, categories, categoryValues, groupByProperty, false, true, true, contextObject, searchResultFilters );
    } );
    var selectedFiltersMap = getSelectedFiltersMap( categories );
    const selectedFiltersInfo = searchFilterService.buildSearchFiltersFromSearchState( selectedFiltersMap );
    contextObject.saveSearchFilterMap = selectedFiltersInfo.activeFilters;
    contextObject.searchFilterCategories = categories;
    nwReportsState.searchIncontextInfo = contextObject;
    return categories;
};

const getDataType = ( typeFilter ) => {
    if( typeFilter === 'NumericFilter' ) {
        return 'DOUBLE';
    } else if( typeFilter === 'DateFilter' ) {
        return 'DATE';
    }
    return 'STRING';
};

const getColumnsAsPerArrangedColumns = ( arrangedColumns, columns ) => {
    let nwColumns = [];
    _.forEach( arrangedColumns, ( arrangeColumn )=> {
        let matchedColumn = _.find( columns, ( column )=>{
            if( column.internalName.includes( arrangeColumn.internalName, 0 ) || arrangeColumn.internalName.includes( column.internalName, 0 ) ) {
                return arrangeColumn;
            }
        } );
        matchedColumn ? nwColumns.push( matchedColumn ) : console.log( 'Column not found :', arrangeColumn.name );
    } );
    return nwColumns;
};

const createColumnProperty = ( property, index, searchFilterMap6, hiddenColumns, sortCriteria )=> {
    // Both if for WSO values
    if( !property.internalName ) {
        property.internalName = property.propInternalValue;
    }
    if( !property.displayName ) {
        property.displayName = property.propDisplayValue;
    }
    var typeN = property.internalName.split( '.' );
    var objectMeta = cmm.getType( typeN[ 0 ] );
    var displayName = property.displayName;
    var internalName = property.internalName;
    var dataType = property.dataType ? property.dataType : getDataType( searchFilterMap6 && searchFilterMap6[internalName] ? searchFilterMap6[internalName][0].searchFilterType : 'StringFilter' );
    if( objectMeta && objectMeta.propertyDescriptorsMap.hasOwnProperty( typeN[ 1 ] ) ) {
        displayName = objectMeta.propertyDescriptorsMap[ typeN[ 1 ] ].displayName;
        dataType = objectMeta.propertyDescriptorsMap[ typeN[ 1 ] ].valueType ? getWSODataType( objectMeta.propertyDescriptorsMap[ typeN[ 1 ] ].valueType ) : dataType;
    }
    let obj = {
        name: typeN[ 1 ],
        displayName: displayName,
        dataType: dataType,
        associatedTypeName: typeN[ 0 ],
        width: index === 0 ? 250 : 200,
        internalName: internalName,
        propertyName: typeN ? typeN[ 1 ] : internalName,
        hiddenFlag: columnHiddenOrNot( internalName, hiddenColumns ),
        sortDirection: getSortDirection( sortCriteria, internalName )
    };
    obj = awColumnService.createColumnInfo( obj );
    if( typeN[ 1 ] === 'release_status_list' || typeN[ 1 ] === 'release_statuses' ) {
        obj.enableSorting = false;
    }
    return obj;
};

const hideSomeColumns = ( columns, reportTable ) => {
    if( reportTable && reportTable.ColumnPropInternalName.length > 0 ) {
        var reportTableColumnProp = [];
        var nwColumns = [];
        _.forEach( columns, ( column, index )=>{
            columns[index].hiddenFlag = reportTable.ColumnPropInternalName.indexOf( column.internalName ) === -1;
            reportTable.ColumnPropInternalName.indexOf( column.internalName ) === -1 && nwColumns.push( column );
        } );
        _.forEach( reportTable.ColumnPropInternalName, ( columnName )=>{
            _.forEach( columns, ( column )=>{
                column.internalName === columnName && reportTableColumnProp.push( column );
            } );
        } );
        columns = reportTableColumnProp.concat( nwColumns );
    } else {
        // For now putting 10 columns visible
        if( columns.length > 9 ) {
            for( let i = 9; i < columns.length; i++ ) {
                columns[i].hiddenFlag = true;
            }
        }
    }
    return columns;
};

const getWSODataType = ( valueType ) => {
    if( valueType === '1' || valueType === 1 ) {
        return 'CHAR';
    } else if( valueType === '2' || valueType === 2 ) {
        return 'DATE';
    } else if( valueType === '3' || valueType === 3 ) {
        return 'DOUBLE';
    } else if( valueType === '6' || valueType === 6 ) {
        return 'BOOLEAN';
    }
    return 'STRING';
};

const getWSOPreferenceProps = function() {
    //Get the prop names from preference for WorkspaceObject.
    var commonList = [];
    if( 'preferences' in appCtxService.ctx && 'WORKSPACEOBJECT_object_columns_shown' in appCtxService.ctx.preferences ) {
        commonList.push.apply( commonList, appCtxService.ctx.preferences.WORKSPACEOBJECT_object_columns_shown );
    }
    if( 'preferences' in appCtxService.ctx && 'WORKSPACEOBJECT_object_columns_hidden' in appCtxService.ctx.preferences ) {
        commonList.push.apply( commonList, appCtxService.ctx.preferences.WORKSPACEOBJECT_object_columns_hidden );
    }
    if( commonList.length > 0 ) {
        var wsoType = cmm.getType( 'WorkspaceObject' );
        var wsoProps = [];
        var wsoPropInterName = [];
        var wsoPropDataType = [];
        var wsoPropName = [];
        _.forEach( commonList, function( currPropName ) {
            if( wsoType !== null && wsoType.propertyDescriptorsMap[ currPropName ] ) {
                wsoProps.push( wsoType.propertyDescriptorsMap[ currPropName ].displayName );
                wsoPropInterName.push( 'WorkspaceObject.' + wsoType.propertyDescriptorsMap[ currPropName ].name );
                wsoPropName.push( wsoType.propertyDescriptorsMap[ currPropName ].name );
                wsoPropDataType.push( getWSODataType( wsoType.propertyDescriptorsMap[ currPropName ].valueType ) );
            }
        } );
        const localTextBundle = localeSvc.getLoadedText( 'ReportChartMessages' );
        wsoProps.push( localTextBundle.objectStrColumnName );

        wsoPropInterName.push( 'WorkspaceObject.object_string' );
        wsoPropName.push( 'object_string' );
        wsoPropDataType.push( 'STRING' );
        var vmWsoPros = listBoxService.createListModelObjectsFromStrings( wsoProps );
        for( var index = 0; index < vmWsoPros.length; index++ ) {
            vmWsoPros[ index ].propInternalValue = wsoPropInterName[ index ];
            vmWsoPros[ index ].dataType = wsoPropDataType[ index ];
            vmWsoPros[index].name = wsoPropName[index];
        }
        return vmWsoPros;
    }
};

let getObjectPropertyListFromPreference = function( ) {
    var prefObjPropList = [];
    if( 'preferences' in appCtxService.ctx && 'REPORT_AW_ObjectType_Properties' in appCtxService.ctx.preferences ) {
        prefObjPropList = appCtxService.ctx.preferences.REPORT_AW_ObjectType_Properties;
    }

    var prefObjProps = {};
    _.forEach( prefObjPropList, function( objPropStr ) {
        var objPropStrSplit = objPropStr.split( ':' );
        //TODO remove {} from prop list, need to change once server CP is modified.
        var propList = objPropStrSplit[ 1 ].replace( '{', '' ).replace( '}', '' );
        prefObjProps[ objPropStrSplit[ 0 ] ] = propList.split( ',' );
    } );
    return prefObjProps;
};

export let overWriteColumns = function( columnProvider, response, hiddenColumns, arrangedColumns, ReportTable1 ) {
    var columns = response.columnConfig.columns;
    arrangedColumns ? columns = arrangedColumns : '';
    ReportTable1 && _.forEach( ReportTable1.ColumnPropInternalName, ( prop, index )=>{
        var property = {
            internalName:prop,
            displayName:ReportTable1.ColumnPropName[index],
            dataType:ReportTable1.ColumnDataType ? ReportTable1.ColumnDataType[index] : undefined
        };
        let foundCol = columns.find( ( { internalName } )=>{
            return internalName.includes( prop, 0 ) || prop.includes( internalName, 0 );
        } );
        !foundCol && columns.push( createColumnProperty( property, undefined, undefined, hiddenColumns, columnProvider?.sortCriteria ) );
    } );
    if( response && response.searchFilterCategories ) {
        var searchFilterCategories = response.searchFilterCategories;
        var searchFilterMap6 = response.searchFilterMap;
        for( var index = 0; index < searchFilterCategories.length; index++ ) {
            let foundCol = columns.find( ( { internalName } )=>{
                return internalName.includes( searchFilterCategories[index].internalName, 0 ) || searchFilterCategories[index].internalName.includes( internalName, 0 );
            } );
            // category column should not be added to the columns
            !foundCol && searchFilterCategories[index].internalName !== 'Categorization.category' && columns.push( createColumnProperty( searchFilterCategories[index], index, searchFilterMap6, hiddenColumns, columnProvider?.sortCriteria ) );
        }
        var wsoColumProps = getWSOPreferenceProps();
        _.forEach( wsoColumProps, ( wsoColumn )=> {
            let matchedColumn  = _.find( columns, ( column )=>{
                if( column.internalName === wsoColumn.propInternalValue ) {
                    return column;
                }
            } );
            if( !matchedColumn ) {
                wsoColumn.name === 'object_string' ?
                    columns.unshift( createColumnProperty( wsoColumn, searchFilterCategories.length, searchFilterMap6, hiddenColumns, columnProvider?.sortCriteria ) ) :
                    columns.push( createColumnProperty( wsoColumn, searchFilterCategories.length, searchFilterMap6, hiddenColumns, columnProvider?.sortCriteria ) );
            }
        } );
        //Now get the prop names from Report preferences...
        let prefObjProps = getObjectPropertyListFromPreference();
        _.forEach( prefObjProps, function( objTypeArray, key ) {
            _.forEach( objTypeArray, function( objType ) {
                var objectMeta = cmm.getType( key );
                if( !objectMeta?.propertyDescriptorsMap || !objectMeta.propertyDescriptorsMap[ objType ] ) {
                    // object type is not loaded in the client meta model
                    return;
                }
                var property = {
                    internalName:key + '.' + objType,
                    displayName:objType,
                    dataType:'STRING'
                };
                var foundCol = columns.find( ( { internalName } )=>{
                    return internalName.includes( objType, 0 ) || objType.includes( internalName, 0 );
                } );
                if( !foundCol ) {
                    let preferenceColumn = createColumnProperty( property, searchFilterCategories.length, searchFilterMap6, hiddenColumns, columnProvider?.sortCriteria );
                    // preference columns will be visible while arrange but hidden by default
                    preferenceColumn.hiddenFlag = true;
                    columns.push( preferenceColumn );
                }
            } );
        } );
    }
    columns = arrangedColumns ? getColumnsAsPerArrangedColumns( arrangedColumns, columns ) : hideSomeColumns( columns, ReportTable1 );
    return columns.filter( ( value, index, self ) =>
        index === self.findIndex( ( t ) =>
            t.name === value.name
        )
    );
};

// Helper function to collect hidden columns from property groups
const collectHiddenColumnsFromGroups = ( columnsByProperty ) => {
    const hiddenColumns = [];

    for ( const columnsGroup of columnsByProperty.values() ) {
        const allHidden = columnsGroup.every( col => col.hiddenFlag || col.visible === false );
        if ( allHidden ) {
            hiddenColumns.push( ...columnsGroup.map( col => col.uid ).filter( Boolean ) );
        }
    }

    return hiddenColumns;
};

export let saveDisplayColumns = ( eventData, reportsState ) => {
    const nwReportsState = reportsState.getValue();
    nwReportsState.reportParameters.hiddenColumns = [];
    nwReportsState.reportParameters.arrangedColumns = [];
    const columnsByProperty = new Map();
    const processedColumns = new Map(); // For deduplication
    let firstElementFound = false;

    _.forEach( eventData.columns, ( column ) => {
        if ( column.propertyName ) {
            if ( !columnsByProperty.has( column.propertyName ) ) {
                columnsByProperty.set( column.propertyName, [] );
            }
            columnsByProperty.get( column.propertyName ).push( column );
        }
        if ( !processedColumns.has( column.propertyName ) || !column.hiddenFlag ) {
            processedColumns.set( column.propertyName, column );
        }
    } );

    // Build arranged columns from deduplicated processedColumns only
    processedColumns.forEach( ( column ) => {
        // Determine internal name
        let columnInternalName = column.internalName ? column.internalName : column.uid;

        // Split the internal name and check its validity
        let typeN = columnInternalName?.split( '.' );  // Split by dot

        // If typeN is a valid array with expected elements
        if ( Array.isArray( typeN ) && typeN.length > 1 ) {
            let columnProp = {
                name: typeN[1] || '', // Access the second part of the split name
                displayName: column.displayName,
                dataType: column.dataType,
                associatedTypeName: typeN[0], // First part of the split name
                width: !firstElementFound ? 250 : 200, // Set the width of the column
                internalName: columnInternalName,
                propertyName: typeN[1] || columnInternalName, // Default to internal name if no valid split part
                hiddenFlag: column.hiddenFlag,
                sortDirection: column.sortDirection
            };
            columnProp = awColumnService.createColumnInfo( columnProp );
            // Mark the first element as found and push the column property to arranged columns
            if ( !column.hiddenFlag && !firstElementFound ) {
                firstElementFound = true;
            }

            nwReportsState.reportParameters.arrangedColumns.push( columnProp );
        }
    } );

    // Collect hidden columns from property groups
    nwReportsState.reportParameters.hiddenColumns = collectHiddenColumnsFromGroups( columnsByProperty );

    reportsState.update( nwReportsState );

    return Array.from( processedColumns.values() );
};

const getColumnConfigData = ( columnConfig, nwReportsState, data, response ) => {
    columnConfig.columnConfigId = 'awReportTableColConfig';
    let params = appCtxService.ctx.state.params;
    let reportTable = nwReportsState.reportParameters.ReportDefProps.ReportTable1;
    // Needs to revisit
    if( reportTable && params.previewMode !== 'false' ) {
        columnConfig.columns = loadColumns( data.columnProviders.staticColumnProvider.sortCriteria, nwReportsState.reportParameters.ReportDefProps.ReportTable1,
            undefined, nwReportsState.reportParameters.hiddenColumns, nwReportsState.reportParameters.arrangedColumns );
    } else {
        columnConfig.columns = overWriteColumns( data.columnProviders.staticColumnProvider, response,
            nwReportsState.reportParameters.hiddenColumns,
            nwReportsState.reportParameters.arrangedColumns,
            nwReportsState.reportParameters.ReportDefProps.ReportTable1 );
    }
    // ColumnResizing getting failed as performSearch soa reassigns deafult width. So overwriting it with current width of the col from the dataProvider.
    var savedColumnConfigData = data.dataProviders.rb0ActiveReportDataProvider?.cols;
    if( savedColumnConfigData?.length > 0 && columnConfig.columns.length > 0 ) {
        _.forEach( columnConfig.columns, function( col, colIdx ) {
            let savedColIdx = col.hiddenFlag === false ? _.findIndex( savedColumnConfigData, function( savedCol ) { return savedCol.propertyName === col.propertyName; } ) : -1;
            if( savedColIdx !== -1 ) {
                columnConfig.columns[colIdx].width = savedColumnConfigData[savedColIdx].width;
            }
        } );
    }
    columnConfig.operationType = 'Intersection';
    //Updating visible columns on reportsState
    nwReportsState.reportParameters.columns = [];
    var ColumnPropNameValues = [];
    var ColumnPropInternalNameValues = [];
    var ColumnDataTypeValues = [];
    _.forEach( columnConfig.columns, ( column )=> {
        if( !column.hiddenFlag ) {
            nwReportsState.reportParameters.columns.push( column );
            ColumnPropNameValues.push( column.displayName );
            ColumnPropInternalNameValues.push( column.associatedTypeName + '.' + column.name );
            ColumnDataTypeValues.push( column.dataType );
        }
    } );
    nwReportsState.reportParameters.ReportDefProps.ReportTable1 = {
        ColumnPropName: ColumnPropNameValues,
        ColumnPropInternalName: ColumnPropInternalNameValues,
        ColumnDataType: ColumnDataTypeValues
    };
};

export let getReportData = ( reportsState, data ) => {
    try {
        //register policy
        var policyId = registerPolicy( reportsState?.reportParameters?.ReportDefProps );
        let nwReportsState = reportsState.getValue();
        nwReportsState.initRepDisp = false;
        //build search input
        var searchInput = getSearchInput( reportsState, data );
        reportsState.update( nwReportsState );
        return tcDataMgmtSvc.basePerformSearchViewModel( {
            columnConfigInput: { clientName: '', clientScopeURI: '' },
            inflateProperties: false,
            noServiceData: false,
            saveColumnConfigData: '',
            searchInput: searchInput } ).then( function( response ) {
            soa_kernel_propertyPolicyService.unregister( policyId );
            if( response.searchResultsJSON ) {
                response.searchResults = JSON.parse( response.searchResultsJSON );
                delete response.searchResultsJSON;
            }
            nwReportsState = reportsState.getValue();
            //getTranslated criterias
            if( response.additionalSearchInfoMap?.translatedSearchCriteriaForPropertySpecificSearch.length > 0 ) {
                nwReportsState.translatedSearchCriteriaForPropertySpecificSearch = response.additionalSearchInfoMap.translatedSearchCriteriaForPropertySpecificSearch;
            }
            if( !nwReportsState.selectedAdvanedQuery || nwReportsState.reportParameters.ReportDefProps?.ReportSearchInfo?.dataProviderName !== 'Rb0ReportsDataProvider' || !nwReportsState.searchInfo ) {
                let searchInfo = { categories:[] };
                //update the reportsState with search info..
                if( response.totalFound > 0 ) {
                    searchInfo = {
                        searchFilterCategories: callRepGetCategories( response, nwReportsState ),
                        categories: response.searchFilterCategories,
                        searchFilterMap: response.searchFilterMap
                    };
                }
                nwReportsState.searchInfo = searchInfo;
            }
            if( !nwReportsState.reportParameters ) {
                nwReportsState.reportParameters = {
                    ReportDefProps: {
                    }
                };
            }
            nwReportsState.reportParameters.totalFound = response.totalFound;
            //getColumnConfig fn
            var columnConfig = response.columnConfig;
            getColumnConfigData( columnConfig, nwReportsState, data, response );
            reportsState.update( nwReportsState );
            // getproperties fn
            var propList = [];
            response.searchFilterCategories.forEach( ( category )=> {
                var namesArr = category.internalName.split( '.' );
                propList.push( namesArr[1] );
            } );
            var arrayUids = [];
            response.searchResults.objects.forEach( ( object )=> arrayUids.push( object.uid ) );
            dmSvc.getProperties( arrayUids, propList ).then( function() {
                // Create view model objects
                response.searchResults = response.searchResults && response.searchResults.objects ? response.searchResults.objects.map( function( vmo ) {
                    vmo = cdm.getObject( vmo.uid );
                    return viewModelObjectService.createViewModelObject( vmo.uid, 'EDIT', null, vmo );
                } ) : [];
            } );
            eventBus.publish( 'reportTable.performSearchCompleted' );
            return { totalFound: response.totalFound, searchResults: response.searchResults, columnConfig: columnConfig, partialErrors: response.ServiceData.partialErrors };
        } );
    } catch ( error ) {
        console.log( 'Failed', error );
        return error;
    }
};

let columnHiddenOrNot = ( columnPropInternalName, hiddenColumns ) => {
    let hidden = false;
    hiddenColumns && _.forEach( hiddenColumns, ( hiddenColumnName )=>{
        if( hiddenColumnName.includes( columnPropInternalName, 0 ) || columnPropInternalName.includes( hiddenColumnName, 0 ) ) {
            hidden = true;
        }
    } );
    return hidden;
};

let getSortDirection = ( sortCriteria, propertyVal ) => {
    let sortDirection = '';
    if( sortCriteria?.length > 0 && sortCriteria[0].fieldName === propertyVal && sortCriteria[0].sortDirection === 'ASC' ) {
        sortDirection = 'Ascending';
    } else if( sortCriteria?.length > 0 && sortCriteria[0].fieldName === propertyVal && sortCriteria[0].sortDirection === 'DESC' ) {
        sortDirection = 'Descending';
    }
    return sortDirection;
};

/**
  * loadColumns
  *
  * @function loadColumns
  * @param {Object} sortCriteria sortCriteria
  * @param {Object} reportTable reportTable
  * @param {number} colmnWidth colmnWidth
  * @param {Array} hiddenColumns hiddenColumns
  * @param {Array} arrangedColumns arrangedColumns
  * @returns {Array} corrected
  */
export let loadColumns = function( sortCriteria, reportTable, colmnWidth, hiddenColumns, arrangedColumns ) {
    var corrected = [];
    var colWidth = colmnWidth === undefined ? 200 : colmnWidth;
    if( !reportTable ) {
        return;
    }
    var typeN = reportTable.ColumnPropInternalName[ 0 ].split( '.' );
    var objectMeta = cmm.getType( typeN[ 0 ] );
    var displayName = reportTable.ColumnPropName[ 0 ];
    var dataType = reportTable.ColumnDataType && reportTable.ColumnDataType[ 0 ] ? reportTable.ColumnDataType[ 0 ] : 'STRING';
    for( var x = 0; x < reportTable.ColumnPropInternalName.length; x++ ) {
        typeN = reportTable.ColumnPropInternalName[ x ].split( '.' );
        objectMeta = cmm.getType( typeN[ 0 ] );
        displayName = reportTable.ColumnPropName[x ];
        dataType = reportTable.ColumnDataType && reportTable.ColumnDataType[ x ] ? reportTable.ColumnDataType[ x ] : 'STRING';
        if( objectMeta && objectMeta.propertyDescriptorsMap.hasOwnProperty( typeN[ 1 ] ) ) {
            displayName = objectMeta.propertyDescriptorsMap[ typeN[ 1 ] ].displayName;
            dataType = objectMeta.propertyDescriptorsMap[ typeN[ 1 ] ].valueType ? getWSODataType( objectMeta.propertyDescriptorsMap[ typeN[ 1 ] ].valueType ) : dataType;
        }
        let obj = {
            name: typeN[ 1 ],
            displayName: displayName,
            dataType: dataType,
            associatedTypeName: typeN[ 0 ],
            width: x === 0 ? 250 : colWidth,
            internalName: reportTable.ColumnPropInternalName[ x ],
            propertyName: typeN ? typeN[ 1 ] : reportTable.ColumnPropInternalName[ x ],
            hiddenFlag: columnHiddenOrNot( reportTable.ColumnPropInternalName[ x ], hiddenColumns ),
            sortDirection: getSortDirection( sortCriteria, reportTable.ColumnPropInternalName[ x ] )
        };
        obj = awColumnService.createColumnInfo( obj );
        if( typeN[ 1 ] === 'release_status_list' || typeN[ 1 ] === 'release_statuses' ) {
            obj.enableSorting = false;
        }
        corrected.push( obj );
    }
    arrangedColumns ? corrected = getColumnsAsPerArrangedColumns( arrangedColumns, corrected ) : '';
    return corrected;
};

export const saveColumnConfig = ( eventData )=>{
    return eventData.columns;
};

export const handleSelectionMode = ( commandContext ) => {
    if ( commandContext.showCheckBox && commandContext.showCheckBox.update ) {
        // We need to flip the value of showCheckBox to true or false and update the state.
        commandContext.showCheckBox.update( !commandContext.showCheckBox.value );
    }
};

export default exports = {
    awReportTableServiceRenderFunction,
    callRepGetSearchCriteria,
    callRepGetProviderName,
    callRepGetCategories,
    overWriteColumns,
    saveDisplayColumns,
    getReportData,
    loadColumns,
    saveColumnConfig,
    handleSelectionMode
};
