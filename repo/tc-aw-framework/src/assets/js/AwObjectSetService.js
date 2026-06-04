// Copyright (c) 2021 Siemens
import _ from 'lodash';
import AwObjectSetList from 'viewmodel/AwObjectSetListViewModel';
import AwObjectSetTable from 'viewmodel/AwObjectSetTableViewModel';
import AwObjectSetTree from 'viewmodel/AwObjectSetTreeViewModel';
import AwReusableObjectSetTable from 'viewmodel/AwWalkerObjectSetReusableTableViewModel';
import { AwServerVisibilityToolbar } from 'js/AwServerVisibilityCommandBarService';
import xrtObjectSetSvc from 'js/xrtObjectSetService';
import browserUtils from 'js/browserUtils';
import { addPlacements } from 'js/commandConfigurationService';
import xrtUtilities from 'js/xrtUtilities';
import adapterService from 'js/adapterService';
import Debug from 'debug';
import tableSvc from 'js/splmTablePublishedService';
import AwPopup from 'viewmodel/AwPopupViewModel';
import { addCommandsArray, removeCommandsArray } from 'js/objectsetXrtCommands';
import AwPanelSection from 'viewmodel/AwPanelSectionViewModel';


const trace = new Debug( 'selection' );
const _displayModesMap = {
    List: 'listDisplay',
    Table: 'tableDisplay',
    Compare: 'compareDisplay',
    Images: 'thumbnailDisplay',
    Tree: 'treeDisplay'
};
let xrtCommandAliasMap = {
    'com.teamcenter.rac.common.AddNew': 'Awp0ShowAddObject',
    'com.teamcenter.rac.common.AddReference': 'Awp0ShowAddObject',
    'com.teamcenter.rac.viewer.pastewithContext': 'Awp0Paste'
};

const _getCurrentDisplayMode = ( objsetdata, activeDisplay ) => {
    let objectSetViewMode = xrtUtilities.getCurrentObjectSetViewMode( objsetdata );
    let activeDisplayValue = _populateActiveDisplay( objsetdata, objectSetViewMode );

    if( activeDisplay ) {
        activeDisplayValue = activeDisplay.value;
    }

    return activeDisplayValue;
};

export const awObjectSetRenderFunction = ( props ) => {
    let {
        titlekey,
        displaytitle,
        viewModel,
        subPanelContext,
        firstPageUids,
        vmo,
        objsetdata,
        columns,
        objSetUri,
        fields,
        dpRef,
        operationType,
        xrtContext,
        objectSetInfo,
        editContextKey,
        isRefreshAllObjectSets,
        reload,
        selectionModel,
        totalFound,
        unreadableObjectsCount,
        gridInfo,
        enablePropEdit,
        parentUid,
        caption,
        collapsed,
        useSection,
        elementRefList,
        actions
    } = props;

    if( !objsetdata  ) {
        return;
    }

    const { data } = viewModel;
    const currentDisplayVal = _getCurrentDisplayMode( objsetdata );
    const objectSetRef = elementRefList.get( 'objectset' );
    const objectSetHeightAndWidthStyleRef = elementRefList.get( 'objectSetHeightAndWidthStyle' );

    const { fileUploadPopup } = actions;

    // control file upload progress popup visibility when dropping files on object-set
    manageFileUploadPopupState( fileUploadPopup, fields.objectSetState );

    let totalLoaded = firstPageUids ? firstPageUids.length : 0;
    if ( fields.objectSetState.totalLoaded !== null && fields.objectSetState.totalLoaded !== undefined ) {
        totalLoaded = fields.objectSetState.totalLoaded;
    }
    if ( fields.objectSetState.totalFound !== null && fields.objectSetState.totalFound !== undefined && fields.objectSetState.totalFound !== -1 ) {
        totalFound = fields.objectSetState.totalFound;
    }
    if ( fields.objectSetState.unreadableCount !== null && fields.objectSetState.unreadableCount !== undefined && fields.objectSetState.unreadableCount !== -1 ) {
        unreadableObjectsCount = fields.objectSetState.unreadableCount;
    }
    const isObjectSetSourceDCP = xrtUtilities.isObjectSetSourceDCP( objsetdata.source );
    const editContextKeyIn = editContextKey ? editContextKey : 'NONE';
    const selectionModelIn = selectionModel ? selectionModel : viewModel.selectionModels.objectSetSelectionModel;

    _setObjectSetHeightAndWidthInternal( { value: currentDisplayVal }, objsetdata, columns, totalLoaded, objectSetHeightAndWidthStyleRef, editContextKeyIn, objectSetRef );

    if( data && data.context ) {
        // while changing display mode, reload the data from server
        if( data.context.currentDisplay !== fields.displayModeState.getValue().activeDisplay ) {
            data.reload = true;
        }
        if( data.context.currentDisplay !== fields.displayModeState.getValue().activeDisplay ||
            data.context.vmo.uid !== vmo.uid ||
            data.context.objectSetState !== fields.objectSetState || data.context.objectSetSource !== objsetdata.source ||
            data.context.selectionModel !== selectionModelIn ||
            data.context.selectionData !== fields.selectionData ) {
            data.context = xrtUtilities.buildCommandContext( objsetdata, fields.displayModeState, fields.objectSetState, currentDisplayVal,

                selectionModelIn, fields.selectionData, { titlekey, displaytitle, columns, vmo, subPanelContext, operationType,
                    dpRef, objSetUri, xrtContext, parentUid, unreadableObjectsCount } );
        }
    }

    let enableReusableTable = false;
    if( gridInfo && gridInfo.enableReusableTable ) {
        enableReusableTable = true;
    }
    let showDropArea = true;
    if( objsetdata ) {
        showDropArea = !( objsetdata.showDropArea && objsetdata.showDropArea === 'false' );
    }
    objsetdata.showDropArea = showDropArea;
    const reloadIn = data.reload ? data.reload : reload;

    const getObjectSet = () => {
        return <div className='aw-walker-objectset' ref={objectSetRef}>
            { data.placementTracker && !useSection ? <div className='aw-xrt-objectSetToolbar'>
                {/* To fully support server visibility in object sets this should pass local object set selection info */}
                <AwServerVisibilityToolbar key={JSON.stringify( data.placementTracker.placements )} secondAnchor={objsetdata.id + ',aw_objectSet_right,aw_objectSet'}
                    reverseSecond orientation='HORIZONTAL' context={data.context} mselected={data.context?.mselected}></AwServerVisibilityToolbar>
            </div> : null }
            <div className='aw-xrt-objectSetContent aw-layout-flexColumn aw-base-scrollPanel' ref={objectSetHeightAndWidthStyleRef}>
                {currentDisplayVal === 'listDisplay' ? <AwObjectSetList
                    selectionModel={selectionModelIn}
                    firstPageUids={firstPageUids}
                    selectionData={fields.selectionData}
                    vmo={vmo}
                    objectSetData={objsetdata}
                    operationType={operationType}
                    showCheckbox={fields.objectSetState.value.showCheckBox}
                    selectAll={fields.objectSetState.value.selectAll}
                    objectSetUri={objSetUri}
                    isObjectSetSourceDCP={isObjectSetSourceDCP}
                    objectSetInfo={objectSetInfo}
                    xrtContext={xrtContext}
                    reload={reloadIn}
                    isRefreshAllObjectSets={isRefreshAllObjectSets}
                    objectSetState={fields.objectSetState}
                    totalFound={totalFound}
                    parentUid={parentUid}
                    subPanelContext={subPanelContext}/> : ''}
                {currentDisplayVal === 'thumbnailDisplay' ? <AwObjectSetList
                    selectionModel={selectionModelIn}
                    firstPageUids={firstPageUids}
                    selectionData={fields.selectionData}
                    vmo={vmo}
                    objectSetData={objsetdata}
                    operationType={operationType}
                    showCheckbox={fields.objectSetState.value.showCheckBox}
                    selectAll={fields.objectSetState.value.selectAll}
                    objectSetUri={objSetUri}
                    isObjectSetSourceDCP={isObjectSetSourceDCP}
                    objectSetInfo={objectSetInfo}
                    isImage={true}
                    xrtContext={xrtContext}
                    reload={reloadIn}
                    isRefreshAllObjectSets={isRefreshAllObjectSets}
                    objectSetState={fields.objectSetState}
                    totalFound={totalFound}
                    parentUid={parentUid}
                    subPanelContext={subPanelContext}/> : ''}
                {currentDisplayVal === 'tableDisplay' && enableReusableTable ? <AwReusableObjectSetTable
                    selectionModel={selectionModelIn}
                    firstPageUids={firstPageUids}
                    selectionData={fields.selectionData}
                    vmo={vmo}
                    objectSetData={objsetdata}
                    operationType={operationType}
                    showCheckBox={fields.objectSetState.value.showCheckBox}
                    selectAll={fields.objectSetState.value.selectAll}
                    objectSetUri={objSetUri}
                    columns={columns}
                    objectSetInfo={objectSetInfo}
                    dpRef={dpRef}
                    xrtContext={xrtContext}
                    reload={reloadIn}
                    editContextKey={editContextKeyIn}
                    isRefreshAllObjectSets={isRefreshAllObjectSets}
                    objectSetState={fields.objectSetState}
                    totalFound={totalFound}
                    gridInfo={gridInfo}
                    enablePropEdit={enablePropEdit}
                    parentUid={parentUid}
                    subPanelContext={subPanelContext}/> : ''}
                {currentDisplayVal === 'tableDisplay' && !enableReusableTable ? <AwObjectSetTable
                    selectionModel={selectionModelIn}
                    firstPageUids={firstPageUids}
                    selectionData={fields.selectionData}
                    vmo={vmo}
                    objectSetData={objsetdata}
                    operationType={operationType}
                    showCheckBox={fields.objectSetState.value.showCheckBox}
                    selectAll={fields.objectSetState.value.selectAll}
                    objectSetUri={objSetUri}
                    columns={columns}
                    objectSetInfo={objectSetInfo}
                    dpRef={dpRef}
                    xrtContext={xrtContext}
                    reload={reloadIn}
                    editContextKey={editContextKeyIn}
                    isRefreshAllObjectSets={isRefreshAllObjectSets}
                    objectSetState={fields.objectSetState}
                    totalFound={totalFound}
                    gridInfo={gridInfo}
                    enablePropEdit={enablePropEdit}
                    parentUid={parentUid}
                    subPanelContext={subPanelContext}/> : ''}
                { currentDisplayVal === 'compareDisplay' && enableReusableTable ? <AwReusableObjectSetTable
                    selectionModel={selectionModelIn}
                    firstPageUids={firstPageUids}
                    selectionData={fields.selectionData}
                    vmo={vmo}
                    objectSetData={objsetdata}
                    operationType={operationType}
                    showCheckBox={fields.objectSetState.value.showCheckBox}
                    objectSetUri={objSetUri}
                    columns={columns}
                    objectSetInfo={objectSetInfo}
                    dpRef={dpRef}
                    isCompareTable={true}
                    xrtContext={xrtContext}
                    reload={reloadIn}
                    editContextKey={editContextKeyIn}
                    isRefreshAllObjectSets={isRefreshAllObjectSets}
                    objectSetState={fields.objectSetState}
                    totalFound={totalFound}
                    gridInfo={gridInfo}
                    enablePropEdit={enablePropEdit}
                    parentUid={parentUid}
                    subPanelContext={subPanelContext}/> : ''}
                { currentDisplayVal === 'compareDisplay' && !enableReusableTable ? <AwObjectSetTable
                    selectionModel={selectionModelIn}
                    firstPageUids={firstPageUids}
                    selectionData={fields.selectionData}
                    vmo={vmo}
                    objectSetData={objsetdata}
                    operationType={operationType}
                    showCheckBox={fields.objectSetState.value.showCheckBox}
                    objectSetUri={objSetUri}
                    columns={columns}
                    objectSetInfo={objectSetInfo}
                    dpRef={dpRef}
                    isCompareTable={true}
                    xrtContext={xrtContext}
                    reload={reloadIn}
                    editContextKey={editContextKeyIn}
                    isRefreshAllObjectSets={isRefreshAllObjectSets}
                    objectSetState={fields.objectSetState}
                    totalFound={totalFound}
                    gridInfo={gridInfo}
                    enablePropEdit={enablePropEdit}
                    parentUid={parentUid}
                    subPanelContext={subPanelContext}/> : '' }
                { currentDisplayVal === 'treeDisplay' ? <AwObjectSetTree
                    selectionModel={selectionModelIn}
                    firstPageUids={firstPageUids}
                    selectionData={fields.selectionData}
                    vmo={vmo}
                    objectSetData={objsetdata}
                    operationType={operationType}
                    showCheckBox={fields.objectSetState.value.showCheckBox}
                    selectAll={fields.objectSetState.value.selectAll}
                    objectSetUri={objSetUri}
                    columns={columns}
                    objectSetInfo={objectSetInfo}
                    dpRef={dpRef}
                    xrtContext={xrtContext}
                    reload={reloadIn}
                    editContextKey={editContextKeyIn}
                    isRefreshAllObjectSets={isRefreshAllObjectSets}
                    objectSetState={fields.objectSetState}
                    totalFound={totalFound}
                    gridInfo={gridInfo}
                    enablePropEdit={enablePropEdit}
                    parentUid={parentUid}/> : '' }
            </div>
            <AwPopup { ...fileUploadPopup.options }></AwPopup>
        </div>;
    };

    const getKey = ( placementTracker ) => {
        return placementTracker?.placements ? JSON.stringify( placementTracker.placements ) : undefined;
    };

    if( data.context ) {
        data.context.mselected = data.selectedObjects && data.selectedObjects.length > 0 ? data.selectedObjects : undefined;
    }

    let hasCountInfo = false;

    if( useSection ) {
        if( totalFound ) {
            caption = caption + ' (' + totalFound + ')';
            hasCountInfo = true;
        }

        if( getKey( data.placementTracker )  ) {
            // wrap objectSet in section
            if( unreadableObjectsCount && unreadableObjectsCount > 0 ) {
                return <div>
                    <AwPanelSection key={getKey( data.placementTracker )} caption={caption} titlekey={titlekey} hasCountInfo={hasCountInfo} collapsed={collapsed} includeComponentName='AwUnreadableCount' includeComponentPosition='LEFT' context={data.context}
                        reverseSecond={true} anchor={'aw_objectSetSection,' + objsetdata.id} anchorPosition='RIGHT' name={props.name} hideCommandsWhenCollapsed='true'>
                        { <div>
                            { getObjectSet() }
                        </div> }
                    </AwPanelSection>
                </div>;
            }

            return <div>
                <AwPanelSection key={getKey( data.placementTracker )} caption={caption} titlekey={titlekey} collapsed={collapsed} hasCountInfo={hasCountInfo} context={data.context}
                    reverseSecond={true} anchor={'aw_objectSetSection,' + objsetdata.id} anchorPosition='RIGHT' name={props.name} hideCommandsWhenCollapsed='true'>
                    { <div>
                        { getObjectSet() }
                    </div> }
                </AwPanelSection>
            </div>;
        }
        return null;
    }

    return getObjectSet();
};

export const initialize = ( objsetdata, displayModeState, objectSetState, selectionModel, placementTrackerIn, selectionData,
    { titlekey, displaytitle, columns, vmo, subPanelContext, operationType, dpRef, objSetUri, xrtContext, parentUid, unreadableObjectsCount, totalFound }  ) => {
    let showDropArea = true;
    let currentDisplay = null;
    let newDisplayModeState = { ...displayModeState.getValue() };

    // keep objectSetState totalFound value in sync with the totalFound prop
    let newobjectSetState = { ...objectSetState.getValue() };
    newobjectSetState.totalFound = totalFound;
    delete newobjectSetState.totalLoaded;
    if( typeof objectSetState.update === 'function' ) {
        objectSetState.update( newobjectSetState );
    }

    if( objsetdata ) {
        /**
         * Add compare display mode to displayModes because compare is a client side option and
         * not coming from XRT.
         */
        objsetdata.displayModes[ _displayModesMap.Compare ] = objsetdata.displayModes[ _displayModesMap.Table ];
        showDropArea = !( objsetdata.showDropArea && objsetdata.showDropArea === 'false' );

        currentDisplay = _getCurrentDisplayMode( objsetdata );

        newDisplayModeState.activeDisplay = currentDisplay;
    }
    // Generate placements specific to the current object set.
    const dynamicPlacements = objsetdata.commands.map( function( command, idx ) {
        if( addCommandsArray.includes( command.commandId ) ) {
            return {
                id: xrtCommandAliasMap[ command.commandId ] || command.commandId,
                priority: 200,
                uiAnchor: objsetdata.id
            };
        }
        if( removeCommandsArray.includes( command.commandId ) ) {
            return {
                id: xrtCommandAliasMap[ command.commandId ] || command.commandId,
                priority: 190,
                uiAnchor: objsetdata.id
            };
        }
        if( command.commandId === 'com.teamcenter.rac.viewer.pastewithContext' ) {
            return {
                id: xrtCommandAliasMap[ command.commandId ] || command.commandId,
                priority: 100,
                uiAnchor: objsetdata.id,
                showTitle: 'never'
            };
        }
        return {
            id: xrtCommandAliasMap[ command.commandId ] || command.commandId,
            priority: idx * 10,
            uiAnchor: objsetdata.id
        };
    } );

    if( placementTrackerIn ) {
        placementTrackerIn.remove();
    }
    const placementTracker = addPlacements( dynamicPlacements );

    const context = xrtUtilities.buildCommandContext(  objsetdata, displayModeState, objectSetState, currentDisplay, selectionModel, selectionData, { titlekey, displaytitle, columns,
        vmo, subPanelContext, operationType, dpRef, objSetUri, xrtContext, parentUid, unreadableObjectsCount } );

    return {
        displayModeState: newDisplayModeState,
        objectSetState: newobjectSetState,
        showDropArea,
        placementTracker,
        context
    };
};

export const cleanup = ( placementTracker ) => {
    if( placementTracker ) {
        placementTracker.remove();
    }
};

const _populateActiveDisplay = ( objsetdata, objectSetViewMode ) => {
    let activeDisplay = _displayModesMap.List;
    if( objectSetViewMode && objsetdata.displayModes[ objectSetViewMode ] ) {
        activeDisplay = objectSetViewMode;
    } else if( objsetdata.defaultDisplay ) {
        activeDisplay = objsetdata.defaultDisplay;
    }
    return activeDisplay;
};

/**
 * Set Objectset height and width
 */
const _setObjectSetHeightAndWidthInternal = ( activeDisplay, objsetdata, columns = [], totalLoaded, objectSetHeightAndWidthStyleRef, editContextKeyIn, objectSetRef ) => {
    // LCS-138303 - Performance tuning for 14 Objectset Table case - implementation
    // - Move height calcluation logic to separate function without timeout.
    // - Add logic for stop event publish when height is not changed.
    // - We can tune it later by deprecate _setObjectSetHeightAndWidth - don't see any
    //   reason we need a $timout here from all callers in this file
    var newHeight = xrtObjectSetSvc.calculateObjectsetHeight( activeDisplay, objsetdata, columns, totalLoaded, objectSetRef );
    var gridid = `${xrtUtilities.generateGridIdForObjectset( editContextKeyIn )}` + objsetdata.id + '_Provider';
    if( activeDisplay.value === 'compareDisplay' ) {
        gridid += '_compare';
    }

    if( objectSetRef?.current?.getElementsByClassName( tableSvc.CLASS_TABLE )[0]  && ( activeDisplay.value === 'tableDisplay' || activeDisplay.value === 'treeDisplay' ) ) {
        tableSvc.setContainerHeight( objectSetRef?.current?.getElementsByClassName( tableSvc.CLASS_TABLE )[0], newHeight - 5 );
    }
    if( objectSetHeightAndWidthStyleRef && objectSetHeightAndWidthStyleRef.current && objectSetHeightAndWidthStyleRef.current.style ) {
        objectSetHeightAndWidthStyleRef.current.style.maxHeight = newHeight + 'px';
        objectSetHeightAndWidthStyleRef.current.style.width = browserUtils.isIE ? 'calc(100% - 10px)' : '100%';
    }
};

export const handleFocusChange = ( localSelectionData, focusComponent, selectionModel, dispatch ) => {
    trace( 'AwObjectsetService: clearing localSelectionData ', localSelectionData );
    if( focusComponent && localSelectionData._modelId && focusComponent !== 'clear'
        && localSelectionData._modelId !== focusComponent && selectionModel
        && selectionModel.getSelection().length > 0 ) {
        selectionModel.selectNone();
        trace( 'AwObjectset localselectiondata cleared: ', true );
        dispatch( { path: 'data._isClearedComponent', value: true } );
    }

    if( focusComponent === 'clear' && selectionModel.getSelection().length > 0 ) {
        selectionModel.selectNone();
        trace( 'AwObjectset localselectiondata cleared: ', false );
        dispatch( { path: 'data._isClearedComponent', value: false } );
    }
};

export const handleSelectionChange = async( localSelectionData, parentSelectionData, isClearedComponent, dispatch, vmo ) => {
    if ( !_.isEmpty( localSelectionData ) && !isClearedComponent ) {
        let baseSelection;
        const { selectedObjects, relationInfo } = await xrtUtilities.getAdaptedSelectionWithRelationInfo( localSelectionData, baseSelection );
        parentSelectionData && parentSelectionData.update( {
            ...localSelectionData,
            selected: selectedObjects,
            relationInfo: relationInfo,
            pselected: vmo
        } );
        trace( 'AwObjectsetService parentSelectionData updated: ', localSelectionData );
    } else {
        trace( 'AwObjectsetService ignoring parentSelectionData update: ', isClearedComponent );
    }
    if ( isClearedComponent ) {
        dispatch( { path: 'data._isClearedComponent', value: false } );
    }
};

export const handleUpdatedSelection = async( localSelectionData ) => {
    return await adapterService.getAdaptedObjects( localSelectionData.selected );
};

export const handleActiveComponentChange = ( localSelectionData,  isSublocationActive, parentSelectionModel, localPWASelectionModel ) => {
    if( !_.isEmpty( localSelectionData ) ) {
        const inUseSelectionModel = parentSelectionModel ? parentSelectionModel : localPWASelectionModel;
        if ( !isSublocationActive ) {
            if ( localSelectionData.selected.length > 0  && inUseSelectionModel.isSelectionModelActivated() ) {
                inUseSelectionModel.setSelectionModelActivated( false );
            }
        } else{
            if ( localSelectionData.selected.length > 0 && !inUseSelectionModel.isSelectionModelActivated() ) {
                inUseSelectionModel.setSelectionModelActivated( true );
            }
        }
    }
};


const manageFileUploadPopupState = ( popupAction, objectSetState ) => {
    const currentObjectSetState = { ...objectSetState.getValue() };

    // provide latest prop values
    popupAction.options.context = {
        files: currentObjectSetState.files
    };

    // popup is shown when 'showUploadPopup' is set, AND it is a newly triggered file upload
    // user can close the popup any time during upload progress
    // In that case, 'showUploadPopup' is still true, so we do not want to show the popup again unless it's a fresh upload
    // For differentiating between a fresh upload and user closing the popup mid-upload
    // we use 'undefined' and 'false' state of 'open', respectively
    if( currentObjectSetState.showUploadPopup === true && popupAction.open === undefined ) {
        popupAction();
    } else if ( !currentObjectSetState.showUploadPopup && ( popupAction.open || popupAction.open === false ) ) {
        // upload is done, set the 'open' flag to undefined so that next time we know it's a fresh upload`
        popupAction.options.api.update( { open: undefined } );
    }
};

export default {
    awObjectSetRenderFunction,
    initialize,
    cleanup,
    handleFocusChange,
    handleSelectionChange,
    handleActiveComponentChange,
    handleUpdatedSelection
};
