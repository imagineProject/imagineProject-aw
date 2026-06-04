// Copyright (c) 2021 Siemens
import _ from 'lodash';
import xrtUtilities from 'js/xrtUtilities';
import xrtParserService from 'js/xrtParser.service';
import AwWalkerProperty from 'viewmodel/AwWalkerPropertyViewModel';
import AwWalkerImage from 'viewmodel/AwWalkerImageViewModel';
import AwWalkerLabel from 'viewmodel/AwWalkerLabelViewModel';
import AwBreak from 'viewmodel/AwBreakViewModel';
import AwSeparator from 'viewmodel/AwSeparatorViewModel';
import AwObjectSet from 'viewmodel/AwObjectSetViewModel';
import AwWalkerHtmlPanel from 'viewmodel/AwWalkerHtmlPanelViewModel';
import AwGuidanceMessage from 'viewmodel/AwGuidanceMessageViewModel';
import AwTableProperty from 'viewmodel/AwTablePropertyViewModel';
import AwNameValueProperty from 'viewmodel/AwNameValuePropertyViewModel';
import AwWalkerClassificationProperties from 'viewmodel/AwWalkerClassificationPropertiesViewModel';
import tcDataManagementService from 'js/tcDataManagementService';
import { DerivedStateResult } from 'js/derivedContextService';

const _displayModesMap = {
    List: 'listDisplay',
    Table: 'tableDisplay',
    Tree: 'treeDisplay',
    Compare: 'compareDisplay',
    Images: 'thumbnailDisplay'
};

export const awWalkerChildRenderFunction = ( {
    elemdata,
    xrtData,
    selectionData,
    xrtState,
    activeState,
    enableResizeCallback,
    vmo,
    type,
    objectType,
    ctxMin: { extractColumnsClass },
    childData,
    dpRef,
    subPanelContext,
    xrtContext,
    objectSetInfo,
    focusComponent,
    editContextKey
} ) => {
    return handleNonColumnAndNonSectionElements( childData, xrtData, elemdata, selectionData,
        xrtState, activeState, enableResizeCallback, vmo, type, objectType, extractColumnsClass[ 0 ], dpRef,
        subPanelContext, xrtContext, objectSetInfo, focusComponent, editContextKey );
};

const handleObjectSet = ( child, elemdata, xrtData, firstPageUids, subPanelContext, vmo, columns,
    selectionData, dpRef, xrtContext, objectSetInfo, focusComponent, editContextKey, useSection = false ) => {
    let objSetUri = '';
    let operationType = 'union';
    let totalFound = -1;
    let unreadableObjectsCount = -1;
    let gridInfo = {};
    let parentUid;
    let enablePropEdit = true;
    if( xrtData && xrtData.dataProviders && xrtData.dataProviders[ `${child.id}_Provider` ] ) {
        totalFound = parseInt( xrtData.dataProviders[ `${child.id}_Provider` ].totalFound );
        unreadableObjectsCount = parseInt( xrtData.dataProviders[ `${child.id}_Provider` ].totalUnreadableCount );
    }

    if( child.defaultDisplay === _displayModesMap.Table || child.defaultDisplay === _displayModesMap.Tree ) {
        let defaultDisplayModeObj = child.displayModes[ child.defaultDisplay ];
        let gridProvider = xrtData.grids[ defaultDisplayModeObj.gridProvider ];
        gridInfo.enableArrangeMenu = gridProvider.enableArrangeMenu;
        gridInfo.enableReusableTable = gridProvider.enableReusableTable;
        gridInfo.isFilteringEnabled = gridProvider.isFilteringEnabled; // isFilteringEnabled can be set for the objectSet level or column level also. Default is true.
        gridInfo.gridOptions = gridProvider.gridOptions || {};

        let dataProvider = xrtData.dataProviders[ gridProvider.dataProvider ];
        let columnProvider = xrtData.columnProviders[ gridProvider.columnProvider ];

        objSetUri = columnProvider.objectSetUri;
        operationType = columnProvider.columnConfig.operationType;
        firstPageUids = dataProvider.firstPage;

        child.displayModes[ _displayModesMap.Compare ] = child.displayModes[ _displayModesMap.Table ];
        let actionSearchInput = tcDataManagementService.getSearchInputFromActionInputData( xrtData.actions[dataProvider.action].inputData );
        if ( actionSearchInput?.searchCriteria ) {
            parentUid = actionSearchInput.searchCriteria.parentUid;
        }
        if( dataProvider.enablePropEdit === false ) {
            enablePropEdit = false;
        }
    } else {
        let displayModeObj = child.displayModes[ child.defaultDisplay ];
        if( displayModeObj && displayModeObj.dataProvider ) {
            let dataProvider = xrtData.dataProviders[ displayModeObj.dataProvider ];
            if( dataProvider.enablePropEdit === false ) {
                enablePropEdit = false;
            }
            firstPageUids = dataProvider.firstPage;
            let actionSearchInput = tcDataManagementService.getSearchInputFromActionInputData( xrtData.actions[dataProvider.action].inputData );
            if ( actionSearchInput?.searchCriteria ) {
                parentUid = actionSearchInput.searchCriteria.parentUid;
            }
        }

        let tableDisplayModeObj = child.displayModes.tableDisplay;
        if( tableDisplayModeObj ) {
            let gridProvider = xrtData.grids[ tableDisplayModeObj.gridProvider ];
            gridInfo.enableArrangeMenu = gridProvider.enableArrangeMenu;
            gridInfo.enableReusableTable = gridProvider.enableReusableTable;
            gridInfo.gridOptions = gridProvider.gridOptions || {};
            let columnProvider = xrtData.columnProviders[ gridProvider.columnProvider ];
            objSetUri = columnProvider.objectSetUri;
            operationType = columnProvider.columnConfig.operationType;
            child.displayModes[ _displayModesMap.Compare ] = child.displayModes[ _displayModesMap.Table ];
        }
    }

    const selectedTab = xrtUtilities.getSelectedTabFromPages( xrtData );
    const visiblePages = xrtParserService.getDeclVisiblePages( xrtData.data );
    let isRefreshAllObjectSets = false;
    if( visiblePages ) {
        _.forEach( visiblePages, ( page ) => {
            if( page.titleKey === selectedTab && page.refreshAllObjectSets === 'true' ) {
                isRefreshAllObjectSets = true;
            }
        } );
    }

    const contextParent = subPanelContext && subPanelContext.context && subPanelContext.context.pageContext && !subPanelContext.pageContext ? subPanelContext.context : subPanelContext;

    if ( useSection ) {
        let displayTitle = child.displayTitle ? child.displayTitle : elemdata.displayTitle;
        let collapsed = 'collapsed' in elemdata ? elemdata.collapsed : child.collapsed;
        // could use <AwObjectSetSection> directly; instead setting useSection attr for now...
        return <AwObjectSet objsetdata={child} useSection={true} caption={displayTitle} titlekey={child.titleKey} collapsed={collapsed}
            firstPageUids={firstPageUids} operationType={operationType} objSetUri={objSetUri}
            vmo={vmo} columns={columns} selectionData={selectionData} dpRef={dpRef}
            xrtContext={xrtContext} objectSetInfo={objectSetInfo} focusComponent={focusComponent}
            editContextKey={editContextKey} isRefreshAllObjectSets={isRefreshAllObjectSets} gridInfo={gridInfo}
            enablePropEdit={enablePropEdit} totalFound={totalFound} unreadableObjectsCount={unreadableObjectsCount} parentUid={parentUid} subPanelContext={contextParent}></AwObjectSet>;
    }

    return <AwObjectSet objsetdata={child} titlekey={elemdata.titleKey} displaytitle={elemdata.displayTitle}
        firstPageUids={firstPageUids} operationType={operationType} objSetUri={objSetUri}
        vmo={vmo} columns={columns} selectionData={selectionData} dpRef={dpRef}
        xrtContext={xrtContext} objectSetInfo={objectSetInfo} focusComponent={focusComponent}
        editContextKey={editContextKey} isRefreshAllObjectSets={isRefreshAllObjectSets} gridInfo={gridInfo}
        enablePropEdit={enablePropEdit} totalFound={totalFound} parentUid={parentUid} subPanelContext={contextParent}></AwObjectSet>;
};

const handleHtmlPanel = ( child, elemdata, xrtState, enableResizeCallback, subPanelContext, vmo, type, selectionData, dpRef, focusComponent )=>{
    const contextParent = subPanelContext?.context?.pageContext && !subPanelContext.pageContext ? { ...subPanelContext.context, ...subPanelContext } : subPanelContext;
    return <AwWalkerHtmlPanel htmlpaneldata={child} selectionData={selectionData} enableResizeCallback={enableResizeCallback}
        xrtState={xrtState} type={type} vmo={vmo} subPanelContext={contextParent} dpRef={dpRef}
        caption={elemdata.displayTitle} focusComponent={focusComponent}></AwWalkerHtmlPanel>;
};

const handleNonColumnAndNonSectionElements = ( child, xrtData, elemdata, selectionData,
    xrtState, activeState, enableResizeCallback, vmo, type, objectType, columns, dpRef, subPanelContext,
    xrtContext, objectSetInfo, focusComponent, editContextKey ) => {
    let firstPageUids = [];

    let enablePropEdit = true; // This flag controls the direct edit behavior of table. When it is false, direct edit will be disabled.
    if( child.elementType === 'tableProperty' || child.elementType === 'nameValueProperty' ) {
        let dataProvider = xrtData.dataProviders[ `${child.id}_Provider` ];
        if( dataProvider.enablePropEdit === false ) {
            enablePropEdit = false;
        }
    }

    switch ( child.elementType ) {
        case 'property':
            if( xrtState?.xrtVMO?.props ) {
                // labelPosition should be the new property for defining label positions
                // renderingStyle will be deprecated in future
                child.labelPosition = child.labelPosition ? child.labelPosition : child.renderingStyle;
                return <AwWalkerProperty prop={xrtState.xrtVMO.props[ child.propertyName ]} propdata={child}
                    type={type} objectType={objectType} activeState={activeState}></AwWalkerProperty>;
            }
            return null;
        case 'image':
            return <AwWalkerImage imgdata={child} vmo={vmo}></AwWalkerImage>;
        case 'break':
            return <AwBreak></AwBreak>;
        case 'separator':
            return <AwSeparator></AwSeparator>;
        case 'label':
            return <AwWalkerLabel labeldata={child}></AwWalkerLabel>;
        case 'objectSet':
            return handleObjectSet( child, elemdata, xrtData, firstPageUids, subPanelContext, vmo, columns,
                selectionData, dpRef, xrtContext, objectSetInfo, focusComponent, editContextKey );
        case 'objectSetSection':
            return handleObjectSet( child, elemdata, xrtData, firstPageUids, subPanelContext, vmo, columns,
                selectionData, dpRef, xrtContext, objectSetInfo, focusComponent, editContextKey, true );
        case 'htmlpanel':
            return handleHtmlPanel( child, elemdata, xrtState, enableResizeCallback, subPanelContext, vmo, type,

                selectionData, dpRef, focusComponent );
        case 'warningLabel': {
            const warnmessage = {
                messageDefn: {
                    messageText: child.text,
                    messageType: 'WARNING'
                },
                localizedMessage: child.text
            };
            return <AwGuidanceMessage message={warnmessage} bannerStyle='true' showIcon='true' showType='false' ></AwGuidanceMessage>;
        }
        case 'tableProperty':
            firstPageUids = xrtData.dataProviders[ `${child.id}_Provider` ].firstPage;
            return <AwTableProperty tablePropertyData={child} firstPageUids={firstPageUids} columns={xrtData.columnProviders[ `${child.id}_ColumnProvider` ].columns}
                objects={xrtData.data && xrtData.data.objects || {}} operationName={xrtData.data && xrtData.data.operationName || undefined} dpRef={dpRef}
                selectionData={selectionData} editContextKey={editContextKey}  enablePropEdit={enablePropEdit}></AwTableProperty>;
        case 'nameValueProperty':
            firstPageUids = xrtData.dataProviders[ `${child.id}_Provider` ].firstPage;
            return <AwNameValueProperty nameValuePropertyData={child} firstPageUids={firstPageUids} columns={xrtData.columnProviders[ `${child.id}_ColumnProvider` ].columns}
                objects={xrtData.data && xrtData.data.objects || {}} operationName={xrtData.data && xrtData.data.operationName || undefined} dpRef={dpRef}
                selectionData={selectionData} editContextKey={editContextKey} enablePropEdit={enablePropEdit}> </AwNameValueProperty>;
        case 'classificationProperties':
            return <AwWalkerClassificationProperties classificationdata={child}></AwWalkerClassificationProperties>;
    }
};

/**
 * createComponentMemo that uses derived state
 *
 * @param {Object} vmDef View model
 * @param {Object} prop Current properties
 * @returns {[DerivedStateResult]} Derived state configurations
 */
export const extractColumnsMemo = ( vmDef, prop ) => {
    return [ new DerivedStateResult( {
        ctxParameters: [],
        additionalParameters: [ prop.childData, prop.xrtData ],
        compute: ( renderContext, childData, xrtData ) => {
            let columns = [];

            if( childData && childData.displayModes ) {
                let defaultDisplayModeObj = childData.displayModes[ childData.defaultDisplay ];
                let tableDisplayModeObj = childData.displayModes.tableDisplay;
                let treeDisplayModeObj = childData.displayModes.treeDisplay;
                if( defaultDisplayModeObj && defaultDisplayModeObj.gridProvider ) {
                    let gridProvider = xrtData.grids[ defaultDisplayModeObj.gridProvider ];
                    if( gridProvider && gridProvider.columnProvider ) {
                        let columnProvider = xrtData.columnProviders[ gridProvider.columnProvider ];
                        columns = columnProvider && columnProvider.columnConfig ? columnProvider.columnConfig.columns : [];
                    }
                } else if( tableDisplayModeObj && tableDisplayModeObj.gridProvider ) {
                    let gridProvider = xrtData.grids[ tableDisplayModeObj.gridProvider ];
                    if( gridProvider && gridProvider.columnProvider ) {
                        let columnProvider = xrtData.columnProviders[ gridProvider.columnProvider ];
                        columns = columnProvider && columnProvider.columnConfig ? columnProvider.columnConfig.columns : [];
                    }
                } else if( treeDisplayModeObj && treeDisplayModeObj.gridProvider ) {
                    let gridProvider = xrtData.grids[ treeDisplayModeObj.gridProvider ];
                    if( gridProvider && gridProvider.columnProvider ) {
                        let columnProvider = xrtData.columnProviders[ gridProvider.columnProvider ];
                        columns = columnProvider && columnProvider.columnConfig ? columnProvider.columnConfig.columns : [];
                    }
                }
            }

            return columns;
        }
    } ) ];
};
