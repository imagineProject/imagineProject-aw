// Copyright (c) 2022 Siemens

/**
 * @module js/effectivityUnitGroupTableService
 */

import adapterSvc from 'js/adapterService';
import cdm from 'soa/kernel/clientDataModel';
import dmSvc from 'soa/dataManagementService';
import eventBus from 'js/eventBus';
import messageService from 'js/messagingService';
import nestNavSvc from 'js/aceNestedNavigationPanelService';
import _ from 'lodash';
import occmgmtUtils from 'js/occmgmtUtils';
import popupService from 'js/popupService';
import uwPropertyService from 'js/uwPropertyService';
import tableDPReqRespHelper from 'js/tableDataProviderRequestResponseHelper';

var exports = {};

export let getUnitEffectivitiesInfo = function( nestedNavigationState ) {
    var effectivitiesInfo = [];
    let nestedNavigationStateValue = { ...nestedNavigationState.getValue() };
    var effRows = nestedNavigationStateValue.vmRows;
    for( var rowIdx = 0; rowIdx < effRows.length - 1; rowIdx++ ) {
        var endItem = effRows[ rowIdx ].props.enditem;
        var unitRange = effRows[ rowIdx ].props.units;

        if( endItem.dbValue && unitRange.dbValue !== '' ) {
            var endItemObj = adapterSvc.getAdaptedObjectsSync( [ cdm.getObject( endItem.dbValue ) ] )[0];
            let endItemUid = endItemObj.props.items_tag && endItemObj.props.items_tag.dbValues[0] || endItemObj.uid;
            var effectivityInfo = {};
            effectivityInfo.clientId = 'createEffectivities';
            effectivityInfo.endItemComponent = {
                uid:   endItemUid,
                type: 'Item'
            };
            effectivityInfo.decision = 0;
            effectivityInfo.unitRangeText = unitRange.dbValue;

            effectivitiesInfo.push( effectivityInfo );
        }
    }
    return effectivitiesInfo;
};

export let getUnitEffectivitiesInfoForEdit = function( nestedNavigationState, egoToEditUid ) {
    var effectivityList;
    if( egoToEditUid ) {
        var grpRevs = [];
        grpRevs.push( egoToEditUid );
        var groupRevs = cdm.getObjects( grpRevs );
        effectivityList = groupRevs[ 0 ].props.Fnd0EffectivityList;
    }


    var effectivitiesInfo = [];
    let nestedNavigationStateValue = { ...nestedNavigationState.getValue() };
    var effRows = nestedNavigationStateValue.vmRows;
    for( var rowNdx = 0; rowNdx < effRows.length - 1; rowNdx++ ) {
        var endItem = effRows[ rowNdx ].props.enditem;
        var unitRange = effRows[ rowNdx ].props.units;

        var unitRangeText = unitRange.dbValue.constructor === Array ? unitRange.dbValue[ 0 ] : unitRange.dbValue;
        var effectivityInfo = {};
        if( endItem.dbValue && unitRangeText !== '' ) {
            var endItemObj = cdm.getObject( endItem.dbValue );

            effectivityInfo.clientId = 'editEffectivities';
            effectivityInfo.decision = 0;

            if( effRows[ rowNdx ].id.length > 2 ) {
                effectivityInfo.effectivityComponent = {
                    uid: effectivityList?.dbValues?.[rowNdx] || '',
                    type: 'Effectivity'
                };
                effectivityInfo.decision = 1;
            }

            if( endItemObj !== null ) {
                let endItemUid = endItemObj.props.items_tag && endItemObj.props.items_tag.dbValues[0] || endItemObj.uid;
                effectivityInfo.endItemComponent = {
                    uid: endItemUid,
                    type: 'Item'
                };
            }
            effectivityInfo.unitRangeText = unitRangeText;
            effectivitiesInfo.push( effectivityInfo );
        } else if( effRows[ rowNdx ].id.length > 2 && ( endItem.dbValue === '' || unitRange.dbValue === '' ) ) {
            effectivityInfo = {
                clientId : 'editEffectivities',
                effectivityComponent : {
                    uid: effRows[ rowNdx ].id,
                    type: 'Effectivity'
                },
                decision: 2,
                unitRangeText: '',
                endItemComponent: { uid: '', type: 'Item' }
            };
            effectivitiesInfo.push( effectivityInfo );
        }
    }
    return effectivitiesInfo;
};

let createEmptyRow = function( columns, vmRowsLength, vmRows ) {
    var emptyProps = {};
    var emptyObject = {};
    emptyProps.enditem = createProp( 'enditem', '', '', 'ITEM REVISION', columns[1].displayName, false, false );
    emptyProps.units = createProp( 'units', '', '', 'STRING', columns[0].displayName, true, true );

    emptyObject.uid = vmRowsLength + 2;
    emptyObject.props = emptyProps;
    vmRows.push( emptyObject );
};

let setEditableAndPopulateLoadResult = function( vmRows, selectedRow ) {
    if( selectedRow && vmRows.length >= selectedRow ) {
        uwPropertyService.setEditable( vmRows[selectedRow].props.units, true );
    }else{
        uwPropertyService.setEditable( vmRows[0].props.units, true );
    }
    uwPropertyService.setEditState( vmRows, true );

    var loadResult = tableDPReqRespHelper.createTableLoadResult( vmRows.length );
    loadResult.searchResults = vmRows;
    loadResult.totalFound = vmRows.length;
    return loadResult;
};

let createEndItemProp = function( nestedNavigationStateValue, columns, selectedRow ) {
    if( nestedNavigationStateValue.selectedEndItem && nestedNavigationStateValue.selectedEndItem.dbValue ) {
        return createProp( 'enditem', nestedNavigationStateValue.selectedEndItem.value,  nestedNavigationStateValue.selectedEndItem.dbValue, 'ITEM REVISION', columns[1].displayName, false, false );
    } else if( selectedRow >= 0 && nestedNavigationStateValue.vmRows[selectedRow].props && nestedNavigationStateValue.vmRows[selectedRow].props.enditem.dbValue ) {
        return createProp( 'enditem', nestedNavigationStateValue.vmRows[selectedRow].props.enditem.displayValue, nestedNavigationStateValue.vmRows[selectedRow].props.enditem.dbValue, 'ITEM REVISION', columns[1].displayName, false, false );
    }
    return createProp( 'enditem', '', '', 'ITEM REVISION', columns[1].displayName, false, false );
};

let populateVmObject  = function( rowIndex, props, nestedNavigationState, selectedRow ) {
    var vmObject = {};
    if ( nestedNavigationState.vmRows && nestedNavigationState.vmRows.length > 0 && nestedNavigationState.vmRows[selectedRow].id ) {
        vmObject.id = nestedNavigationState.vmRows[selectedRow].id;
    } else {
        vmObject.id = selectedRow + 1;
    }
    vmObject.editableInViewModel = true;
    vmObject.isModifiable = true;
    vmObject.isEditable = true;
    vmObject.uid = rowIndex;
    vmObject.props = props;
    return vmObject;
};

export let createRowData = function( columnProviderInfo, nestedNavigationState, message ) {
    let nestedNavigationStateValue = { ...nestedNavigationState.getValue() };
    var columns = columnProviderInfo.columns;
    var props = {};
    //var vmObject = {};
    var vmRows = nestedNavigationStateValue.vmRows;

    if ( vmRows === undefined ) {
        vmRows = [];
        nestedNavigationStateValue.vmRows = [];
    }

    var vmRowsLength = nestedNavigationStateValue.vmRows.length - 1;
    var selectedRow = nestedNavigationStateValue.selectedRowIndex ? nestedNavigationStateValue.selectedRowIndex : 0;
    if( nestedNavigationStateValue && nestedNavigationStateValue.vmRows.length ) {
        props.enditem = createEndItemProp( nestedNavigationStateValue, columns, selectedRow );
        props.units = createProp( 'units', nestedNavigationStateValue.vmRows[selectedRow].props.units.dbValue, nestedNavigationStateValue.vmRows[selectedRow].props.units.dbValue, 'STRING', columns[0].displayName, true, true );
    } else {
        props.enditem = createProp( 'enditem', '', '', 'ITEM REVISION', columns[1].displayName, false, false );
        props.units = createProp( 'units', '', '', 'STRING', columns[0].displayName, true, true );
    }

    var vmObject = populateVmObject( vmRowsLength + 2, props, nestedNavigationStateValue, selectedRow );
    if( vmRowsLength !== -1 ) {
        vmObject.uid = selectedRow + 1;
        vmObject.selected = true;
        vmRows[selectedRow] = vmObject;
    } else {
        vmRows.push( vmObject );
    }

    var isDuplicateEndItem = checkDuplicateEndItemSelection( nestedNavigationStateValue, message );
    if( isDuplicateEndItem ) {
        // we have populated a duplicate end item, better remove
        vmRows[selectedRow].props.enditem = createProp( 'enditem', '', '', 'ITEM REVISION', columns[1].displayName, false, false );
    } else{
        // add empty row if we are not in the first row and selected row is the last row
        if( vmRowsLength !== -1 && selectedRow === vmRowsLength && nestedNavigationStateValue.selectedEndItem && nestedNavigationStateValue.selectedEndItem.dbValue ) {
            createEmptyRow( columns, vmRowsLength, vmRows );
        }
    }

    // as selected end item is already updated, setting it to blank
    nestedNavigationStateValue.selectedEndItem = {
        value : '',
        dbValue : ''
    };
    //nestedNavigationStateValue.selectedRowIndex =  '';

    nestedNavigationStateValue.vmRows = vmRows;
    nestedNavigationState.update( { ...nestedNavigationStateValue } );

    return setEditableAndPopulateLoadResult( vmRows, selectedRow );
};

let checkDuplicateEndItemSelection = function( nestedNavigationState, message ) {
    let selectedItemUid;
    var selectedItemIndex;
    var selectedUIValue;
    var index = 0;
    var isDuplicate = false;
    if( !nestedNavigationState.vmRows ) {
        return;
    }
    nestedNavigationState.vmRows.forEach( vmr=>{
        if ( vmr.selected ) {
            selectedItemUid = vmr.props.enditem.dbValue;
            selectedUIValue = vmr.props.enditem.displayValue;
            selectedItemIndex = index;
        }
        index++;
    } );

    for( var inx = 0; inx < nestedNavigationState.vmRows.length; inx++ ) {
        var endItem;
        if( Array.isArray( nestedNavigationState.vmRows[0].props.enditem.dbValue ) ) {
            endItem = nestedNavigationState.vmRows[inx].props.enditem.dbValue[0];
        } else{
            endItem = nestedNavigationState.vmRows[inx].props.enditem.dbValue;
        }
        if ( ( nestedNavigationState.vmRows[inx].selected !== true || nestedNavigationState.vmRows[inx].selected === undefined )  && selectedItemUid !== '' &&  selectedItemUid === endItem ) {
            isDuplicate = true;
            var messageText = message;
            messageText = messageText.replace( '{0}', selectedUIValue );
            messageService.showError( messageText );
            uwPropertyService.setValue( nestedNavigationState.vmRows[ selectedItemIndex ].props.enditem, '' );
        }
    }
    return isDuplicate;
};

export let loadEGORowData = async function( columnProviderInfo, egoToEditUid, nestedNavigationState, message ) {
    let nestedNavigationStateValue = { ...nestedNavigationState.getValue() };
    var selectedRow = nestedNavigationStateValue.selectedRowIndex;
    var columns = columnProviderInfo.columns;
    var vmRows = [];

    if( nestedNavigationStateValue.vmRows && nestedNavigationStateValue.vmRows.length > 0 ) {
        vmRows = nestedNavigationStateValue.vmRows;
        var vmRowsLength = vmRows.length;

        for( var rowNdx = 0; rowNdx < vmRowsLength; rowNdx++ ) {
            if ( rowNdx === selectedRow ) {
                var props = {};
                props.enditem = createEndItemProp( nestedNavigationStateValue, columns, selectedRow );
                props.units = createProp( 'units', vmRows[selectedRow].props.units.dbValue, vmRows[selectedRow].props.units.dbValue, 'STRING', columns[0].displayName, true, true );

                var vmObject = populateVmObject( rowNdx + 1, props, nestedNavigationStateValue, selectedRow );
                vmObject.selected = true;
                vmRows[selectedRow] = vmObject;
            }
        }
    } else {
        var grpRevs = [];
        grpRevs.push( egoToEditUid );
        dmSvc.getProperties( grpRevs, [ 'Fnd0EffectivityList' ] );

        var groupRevs = cdm.getObjects( grpRevs );
        var effectivityList = groupRevs[ 0 ].props.Fnd0EffectivityList;
        await dmSvc.getProperties( effectivityList.dbValues, [ 'unit_range_text', 'end_item' ] );

        if( effectivityList.dbValues.length > 0 ) {
            var rowLength = effectivityList.dbValues.length;
            for( var rowNdx = 0; rowNdx < rowLength; rowNdx++ ) {
                var props = {};
                var selected = false;
                var effectivity = cdm.getObjects( [ effectivityList.dbValues[rowNdx] ] );

                if ( rowNdx === selectedRow ) {
                    selected = true;
                    props.enditem = createEndItemProp( nestedNavigationStateValue, columns, selectedRow );
                } else {
                    props.enditem = createProp( 'enditem', effectivity[ 0 ].props.end_item.uiValues[ 0 ], effectivity[ 0 ].props.end_item.dbValues[ 0 ], 'ITEM REVISION', columns[1].displayName, false, false );
                }
                props.units = createProp( 'units', effectivity[ 0 ].props.unit_range_text.uiValues[ 0 ], effectivity[ 0 ].props.unit_range_text.dbValues[ 0 ], 'STRING', columns[0].displayName, true, true );

                var vmObject = populateVmObject( rowNdx + 1, props, nestedNavigationStateValue, selectedRow );
                vmObject.selected = selected;
                vmObject.id = effectivityList.dbValues[ rowNdx ];
                vmRows.push( vmObject );
            }
        }
    }

    var isDuplicateEndItem = checkDuplicateEndItemSelection( nestedNavigationStateValue, message );

    if ( isDuplicateEndItem ) {
        // we have populated a duplicate end item, better remove
        vmRows[selectedRow].props.enditem = createProp( 'enditem', '', '', 'ITEM REVISION', columns[1].displayName, false, false );
    } else{
        if( !( nestedNavigationStateValue.vmRows && nestedNavigationStateValue.vmRows.length > 0 ) ||
         selectedRow === vmRows.length - 1 && nestedNavigationStateValue.selectedEndItem && nestedNavigationStateValue.selectedEndItem.dbValue ) {
            // add empty row
            var vmRowsLength = vmRows.length - 1;
            createEmptyRow( columns, vmRowsLength, vmRows );
        }
    }

    // as selected end item is already updated, setting it to blank
    nestedNavigationStateValue.selectedEndItem = {
        value : '',
        dbValue : ''
    };

    nestedNavigationStateValue.vmRows = vmRows;
    nestedNavigationState.update( { ...nestedNavigationStateValue } );

    return setEditableAndPopulateLoadResult( vmRows, selectedRow );
};

var createProp = function( propName, propValue, dbValue, type, propDisplayName, isPropertyModifiable, isEditable ) {
    return {
        type: type,
        displayValue: propValue,
        uiValue: propValue,
        dbValue: dbValue,
        value: propValue,
        propertyName: propName,
        propertyDisplayName: propDisplayName,
        isEnabled: true,
        isPropertyModifiable: isPropertyModifiable,
        isEditable: isEditable
    };
};

export let appendAndGetExistingGroupEffectivities = function( groupRevision, occContext ) {
    var effGrps = [];

    let egos;
    if( occContext.context && occContext.context.configContext
        && occContext.context.configContext.eg_uids ) {
        egos = { dbValues: occContext.context.configContext.eg_uids };
    } else{
        let productContextInfoModelObject = occContext.productContextInfo;
        egos = productContextInfoModelObject.props.awb0EffectivityGroups;
    }
    var appliedEffGrps = egos;

    if( appliedEffGrps ) {
        effGrps = [ ...appliedEffGrps.dbValues ];
    }

    effGrps.push( groupRevision.uid );
    return effGrps;
};

export let updateEndItemOnState = function( eventData, nestedNavigationState, columnProviderInfo, message  ) {
    var selectedObject = null;
    if( eventData.eventDataValue && eventData.eventDataValue.scope.addPanelState.sourceObjects.length !== 0 ) {
        selectedObject = eventData.eventDataValue.scope.addPanelState.sourceObjects[0];
    }

    let nestedNavigationStateValue = { ...nestedNavigationState.getValue() };

    if( selectedObject ) {
        let selectedEndItemDisplayName = selectedObject.cellHeader2 + '-' + selectedObject.cellHeader1;
        nestedNavigationStateValue.selectedEndItem = {
            value:selectedEndItemDisplayName,
            dbValue : selectedObject.props.items_tag && selectedObject.props.items_tag.dbValues[0] || selectedObject.uid
        };
    } else {
        nestedNavigationStateValue.selectedEndItem = null;
    }

    nestedNavigationState.update( { ...nestedNavigationStateValue } );
    createRowData( columnProviderInfo, nestedNavigationState, message );
};

export let removeEndItem = function( eventData, nestedNavigationState, endItemMessage ) {
    var gridId = Object.keys( eventData.scope.data.grids )[ 0 ];
    var declGrid = eventData.scope.data._internal.grids[ gridId ];
    var uwDataProvider = eventData.scope.data.dataProviders[ declGrid.dataProvider ];
    var loadedVMOs = uwDataProvider.viewModelCollection.getLoadedViewModelObjects();
    let nestedNavigationStateValue = { ...nestedNavigationState.getValue() };
    nestedNavigationStateValue.selectedEndItem = {
        value : '',
        dbValue : ''
    };

    var rowIndex = eventData.scope.commandContext.vmo.uid - 1;
    nestedNavigationStateValue.selectedRowIndex = rowIndex;

    nestedNavigationStateValue.vmRows[rowIndex].props.enditem = createProp( 'enditem', '', '', 'ITEM REVISION', endItemMessage, false, false );
    nestedNavigationState.update( { ...nestedNavigationStateValue } );
    uwDataProvider.update( loadedVMOs );
};

export let updateRowIdxBeforeNavigate = function( eventData, nestedNavigationState ) {
    let nestedNavigationStateValue = { ...nestedNavigationState.getValue() };

    var rowIndex = eventData.scope.commandContext.vmo.uid - 1;
    nestedNavigationStateValue.selectedRowIndex = rowIndex;

    var vmRows = nestedNavigationStateValue.vmRows;
    for( var idx = 0; idx < vmRows.length; idx++ ) {
        vmRows[idx].selected = false;
    }
    vmRows[rowIndex].selected = true;

    nestedNavigationState.update( { ...nestedNavigationStateValue } );
};

export let applyConfiguration = function( value, occContext ) {
    occmgmtUtils.updateValueOnCtxOrState( '', value, occContext );
    popupService.hide();
};

export let setTableEditable = function( dataProvider ) {
    // splm table event
    var context = {
        state: 'starting',
        dataSource: dataProvider
    };
    eventBus.publish( 'editHandlerStateChange', context );
};

export let getExistingAndSearchedGroupEffectivities = function( occContext, selectedGroupEffectivities ) {
    var groupEffectivityUidArray = [];
    if( occContext.productContextInfo.props.awb0EffectivityGroups ) {
        groupEffectivityUidArray = _.clone( occContext.productContextInfo.props.awb0EffectivityGroups.dbValues );
    }
    for( var i = 0; i < selectedGroupEffectivities.length; ++i ) {
        // Add to PCI if not present
        var index = groupEffectivityUidArray.indexOf( selectedGroupEffectivities[ i ].uid );
        if( index === -1 ) {
            groupEffectivityUidArray.push( selectedGroupEffectivities[ i ].uid );
        }
    }
    return groupEffectivityUidArray;
};

export default exports = {
    createRowData,
    loadEGORowData,
    updateEndItemOnState,
    getUnitEffectivitiesInfo,
    appendAndGetExistingGroupEffectivities,
    updateRowIdxBeforeNavigate,
    getUnitEffectivitiesInfoForEdit,
    setTableEditable,
    getExistingAndSearchedGroupEffectivities,
    applyConfiguration,
    removeEndItem
};
