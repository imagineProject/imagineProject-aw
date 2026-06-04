// Copyright (c) 2022 Siemens

/**
 * @module js/pca0AddRangeFeaturePanelService
 */
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import { constants as veConstants } from 'js/pca0VariabilityExplorerConstants';
import dataManagementSvc from 'soa/dataManagementService';
import dateTimeService from 'js/dateTimeService';
import dialogService from 'js/dialogService';
import eventBus from 'js/eventBus';
import localeService from 'js/localeService';
import messagingService from 'js/messagingService';
import pca0CommonUtils from 'js/pca0CommonUtils';
import pca0Constants from 'js/Pca0Constants';
import viewModelObjectService from 'js/viewModelObjectService';

import _ from 'lodash';

/**
 * Publish event to notify creation/update of new Free Form value/Enumerated Range expression
 * @param {String} valueText - value created/update
 * @param {boolean} isFreeForm - True if free form else false
 * @param {Object} selectedObject - Parent object VMO
 * @param {Object} subPanelContext - subPanel context
 * @param {Object} vmoSelected - Object selected is valid feature of family
 */
let _notifyValueChange = function( valueText, isFreeForm, selectedObject, subPanelContext, vmoSelected ) {
    let eventData = {
        sourceID: subPanelContext.sourceID,
        valueText: valueText,
        isFreeForm: isFreeForm
    };

    if ( subPanelContext.sourceID === veConstants.GRID_CONSTANTS.PCA_GRID ||
        subPanelContext.sourceID === veConstants.GRID_CONSTANTS.BOTTOM_CONSTRAINTS_GRID ||
        subPanelContext.sourceID === veConstants.GRID_CONSTANTS.MULTIPLE_SVR_GRID_ID ) {
        eventData.parentNode = selectedObject;
        eventData.selected = [ vmoSelected ];
        eventData.isPanelPinned = subPanelContext.isPanelPinned;
        eventData.isRangeExpression = _.isEmpty( vmoSelected );
        eventData.isTopGrid = subPanelContext.sourceID === veConstants.GRID_CONSTANTS.PCA_GRID;
        eventBus.publish( 'Pca0AddRangeFeaturePanel.addRangeExpression', eventData );
    } else if ( !subPanelContext.updateRange ) {
        eventBus.publish( 'Pca0AddRangeFeaturePanel.valueCreated', eventData );
    } else {
        eventData.oldValueText = subPanelContext.commandContext.value.dbValue;
        eventBus.publish( 'Pca0AddRangeFeaturePanel.valueUpdated', eventData );
    }
};

/**
 * Update list with = sign for fromlist operator
 * @param {Object} fromListValues from list operator values
 */
let _updateFromOperatorListWithEqual = function( fromListValues ) {
    fromListValues.unshift( {
        propInternalValue: '=',
        dispValue: '=',
        propDisplayValue: '=',
        propDisplayDescription: ''
    } );
};

/**
 * Initialize component values
 * @param {*} cmdCtx - CommandCtx to feature value
 * @param {*} fromOperator - From operator component
 * @param {*} fromFeatureVal - From feature component
 * @param {*} toOperator - To operator component
 * @param {*} toFeatureVal - To feature component
 */
let _initializeViewDataFromCmdCtxVCVList = function( cmdCtx, fromOperator, fromFeatureVal, toOperator, toFeatureVal ) {
    let feature = cmdCtx.value.dbValue;
    if( feature.toString().search( />=|<|>|<=/ ) >= 0 ) {
        let featureExpr = feature.split( ' ' );
        if( featureExpr[ 1 ] ) {
            let fromOp = '';
            let toOp = '';
            let toVal = '';
            let fromVal = '';
            fromOp = featureExpr[ 0 ];
            fromVal = featureExpr[ 1 ];
            fromOperator.dbValue = fromOp;
            fromOperator.uiValue = fromOp;
            fromFeatureVal.dbValue = fromVal;
            fromFeatureVal.uiValue = fromVal;
            if( cmdCtx.family.familyType === 'Date' && pca0CommonUtils.isUTCFormatString( fromVal ) ) {
                fromVal = fromVal.split( 'T' )[ 0 ];
                let formatedFromDate = dateTimeService.formatDate( fromVal );
                fromFeatureVal.dbValue = Date.parse( formatedFromDate );
                fromFeatureVal.uiValue = formatedFromDate;
            }
            if( featureExpr[ 3 ] ) {
                toOp = featureExpr[ 3 ];
                toVal = featureExpr[ 4 ];
                toOperator.dbValue = toOp;
                toOperator.uiValue = toOp;
                toFeatureVal.dbValue = toVal;
                toFeatureVal.uiValue = toVal;
                if( cmdCtx.family.familyType === 'Date' ) {
                    toVal = toVal.split( 'T' )[ 0 ];
                    let formatedToDate = dateTimeService.formatDate( toVal );
                    toFeatureVal.dbValue = Date.parse( formatedToDate );
                    toFeatureVal.uiValue = formatedToDate;
                }
            }
        }
    }
};

/**
 * Close the add free form option value panel.
 * @param {Object} subPanelContext VM data
 */
let _closeAddFreeFormOptionValuePanel = function( subPanelContext ) {
    if( subPanelContext && !subPanelContext.panelPinned ) {
        dialogService.closeDialog( 'INFO_PANEL_CONTEXT', subPanelContext.popupOptions.popupId );
    }
};

/**
 * This function helps to create type of control and other details like min and max value of component
 * @param {Object} familyType - Family type coming from command context
 * @param {Object} fromFeatureValue - From widget control
 * @param {Object} toFeatureValue - To widget control
 * @return {Object} Component details for from and to widget
 */
let _getComponentDetails = ( familyType, fromFeatureValue, toFeatureValue ) => {
    let fromComponentData = fromFeatureValue;
    let toComponentData = toFeatureValue;
    let type = _.toUpper( familyType );
    let renderingHint = _.toLower( familyType );
    if ( familyType === pca0Constants.FAMILY_VALUE_TYPES[1] ) {
        // floating point
        type = 'DOUBLE';
        renderingHint = 'double';
    } else if ( familyType === pca0Constants.FAMILY_VALUE_TYPES[3] ) {
        type = 'STRING';
        renderingHint = 'textbox';
    }
    fromComponentData.value = null;
    fromComponentData.dateApi.isTimeEnabled = false;
    fromComponentData.type = type;
    fromComponentData.renderingHint = renderingHint;
    toComponentData.dateApi.isTimeEnabled = false;
    toComponentData.type = type;
    toComponentData.renderingHint = renderingHint;

    return { fromComponentData, toComponentData };
};

/**
 * Helps to updates list values for integer and double
 * @param {Object} listComponent - component data
 * @param {String} displayValues - display values
 * @param {Object} idValues - id values
 * @param {String} typOfFamily - type of family
 * @param {Number} conditionValue - from component list value to set upper limit of toComponent list values
 */
let _updateListValues = ( listComponent, displayValues, idValues, typOfFamily, conditionValue ) => {
    if ( displayValues && idValues ) {
        displayValues.forEach( value => {
            let valueToInsert = value;
            if ( conditionValue && Number( value ) <= Number( conditionValue )  ) {
                valueToInsert = undefined;
            }
            if ( !_.isUndefined( valueToInsert ) ) {
                const objectValues = {
                    propDisplayValue: valueToInsert,
                    propInternalValue: valueToInsert
                };
                listComponent.push( { ...objectValues } );
            }
        } );
    }
};

/**
 * Helps to get required details for panel
 * @param {Object} commandCtx - Command context to initialize data
 * @returns {Object} {
        displayValues,
        idValues,
        isFreeForm,
        familyType,
        familyDisplayName,
        rangeInfo
    };
 */
let _getRequiredDetailsForPanel = ( commandCtx ) => {
    let displayValues = [];
    let idValues = [];
    let isFreeForm = false;
    let familyType = 'String';
    let familyDisplayName = '';
    let selectedObject = '';
    let rangeInfo = '';
    if ( commandCtx.sourceID === pca0Constants.GRID_CONSTANTS.VARIANT_CONDITION ) {
        const selectionInfo = _.get( commandCtx, 'commandContext.gridSelectionState.value.selectionInfo' );
        displayValues = selectionInfo.childrenDispValues;
        idValues = selectionInfo.cfg0ChildrenIDs;
        isFreeForm = selectionInfo.isFreeForm;
        familyType = selectionInfo.type;
        familyDisplayName = selectionInfo.displayName;
        rangeInfo = _.get( selectionInfo, 'props.rangeInfo.uiValue' );
    } else if( commandCtx.sourceID === 'fscFreeFormRangeExpPanel' ) {
        const familyInfo = _.get( commandCtx, 'commandContext.family' );
        displayValues = familyInfo.childrenDispValues;
        idValues = familyInfo.cfg0ChildrenIDs;
        isFreeForm = familyInfo.isFreeForm;
        familyType = familyInfo.familyType;
        familyDisplayName = familyInfo.familyDisplayName;
    } else {
        const vmoObj = _.get( commandCtx, 'commandContext.vmo' );
        isFreeForm = vmoObj.isFreeForm;
        familyType = vmoObj.familyType ? vmoObj.familyType : vmoObj.type;
        familyDisplayName = vmoObj.displayName;
        selectedObject = vmoObj; // To get children of this uid
        selectedObject.Title = vmoObj.displayName;
        selectedObject.cellHeader1 = vmoObj.displayName;
        rangeInfo = _.get( vmoObj, 'props.rangeInfo.uiValue' );
    }
    return {
        displayValues,
        idValues,
        isFreeForm,
        familyType,
        familyDisplayName,
        selectedObject,
        rangeInfo
    };
};

/**
* This method updates the "isSelectOnly" flag of the given list component to true if it is currently false.
* @param {Object} listComponent The list component to update.
*/
let _updateIsSelectOnlyToTrue = ( listComponent ) =>{
    // Check if the "isSelectOnly" flag is currently false.
    if( listComponent.isSelectOnly === false ) {
    // Update the "isSelectOnly" flag to true.
        listComponent.isSelectOnly = true;
    }
};

var exports = {};

/**
 * /**
 * Initialize the properties of view data by using command context
 * @param {Object} dialogData - Component Data
 * @param {Object} cmdCtx - Command Context
 * @return {Object} Required component data
 */
export let initComponentData = ( dialogData, cmdCtx ) => {
    let sourceID = cmdCtx.sourceID;
    if( _.isUndefined( cmdCtx.commandContext.group ) ) { cmdCtx.commandContext.group = {}; }
    if( _.isUndefined( cmdCtx.commandContext.value ) ) { cmdCtx.commandContext.value = {}; }
    const vmData = dialogData.data;
    let fromComponentData = {};
    let toComponentData = {};

    const { displayValues, idValues, isFreeForm, familyType, familyDisplayName, selectedObject, rangeInfo } = _getRequiredDetailsForPanel( cmdCtx );
    const componentDetails = _getComponentDetails( familyType, vmData.fromFeatureComponent, vmData.toFeatureComponent );
    fromComponentData = componentDetails.fromComponentData;
    toComponentData = componentDetails.toComponentData;

    if ( sourceID === pca0Constants.GRID_CONSTANTS.VARIANT_CONDITION ||
        sourceID === veConstants.GRID_CONSTANTS.PCA_GRID ||
        sourceID === veConstants.GRID_CONSTANTS.BOTTOM_CONSTRAINTS_GRID ||
        sourceID === veConstants.GRID_CONSTANTS.MULTIPLE_SVR_GRID_ID ) {
        if ( isFreeForm  || familyType === pca0Constants.FAMILY_VALUE_TYPES[3]
            || sourceID === veConstants.GRID_CONSTANTS.PCA_GRID
            || sourceID === veConstants.GRID_CONSTANTS.BOTTOM_CONSTRAINTS_GRID
            || sourceID === veConstants.GRID_CONSTANTS.MULTIPLE_SVR_GRID_ID ) {
            _updateFromOperatorListWithEqual( vmData.fromOperatorListValues );
            // In case of constraints add range panel, we do not allow to add
            // custom features for 'equal to' operator.
            // Equal to operator is the default operator in constraints add range panel.
            // Hence, directly set isSelectOnly to true.
            // For freeForm and String family, it doesn't matter if isSelectOnly is true/false
            // as it doesn't contain drop down.
            _updateIsSelectOnlyToTrue( vmData.fromFeatureListComponent );
            vmData.showRangeTitle.dispValue = rangeInfo;
            vmData.showRangeTitle.uiValue = rangeInfo;
        }
    } else if( sourceID === 'fscFreeFormRangeExpPanel' ) {
        const familyInfo = _.get( cmdCtx, 'commandContext.family' );
        appCtxSvc.updatePartialCtx( cmdCtx.contextKey + '.isFreeFormCtx.commandContext', cmdCtx.commandContext );
        vmData.showRangeTitle.dispValue = familyInfo.allowedRange;
        vmData.showRangeTitle.uiValue = familyInfo.allowedRange;
        if( ( isFreeForm || cmdCtx.updateRange ) && !_.isEmpty( cmdCtx.commandContext.value ) ) {
            if ( familyType === 'Date' ) {
                _initializeViewDataFromCmdCtxVCVList( cmdCtx.commandContext, vmData.fromOperator, vmData.fromDateFeatureComponent, vmData.toOperator, vmData.toDateFeatureComponent );
                if ( cmdCtx.commandContext.value.dbValue ) {
                    vmData.fromDateFeatureComponent.uiValue = vmData.fromFeatureComponent.uiValue;
                    vmData.fromDateFeatureComponent.dbValue = vmData.fromFeatureComponent.dbValue;
                    vmData.toDateFeatureComponent.uiValue = vmData.toFeatureComponent.uiValue;
                    vmData.toDateFeatureComponent.dbValue = vmData.toFeatureComponent.dbValue;
                }
            } else  {
                _initializeViewDataFromCmdCtxVCVList( cmdCtx.commandContext, vmData.fromOperator, vmData.fromFeatureComponent, vmData.toOperator, vmData.toFeatureComponent );
            }
        }
    }

    if ( !isFreeForm && ![ pca0Constants.FAMILY_VALUE_TYPES[ 2 ] /* Date */, pca0Constants.FAMILY_VALUE_TYPES[3] /* String */ ].includes( familyType ) ) {
        _updateListValues( vmData.fromEnumListFeatureValues, displayValues, idValues, familyType );
        vmData.fromFeatureListComponent.type = fromComponentData.type;
        vmData.toFeatureListComponent.type = fromComponentData.type;
        if ( sourceID === 'fscFreeFormRangeExpPanel' && cmdCtx.commandContext.value.dbValue ) {
            vmData.fromFeatureListComponent.uiValue = vmData.fromFeatureComponent.uiValue;
            vmData.fromFeatureListComponent.dbValue = vmData.fromFeatureComponent.dbValue;
            vmData.toFeatureListComponent.uiValue = vmData.toFeatureComponent.uiValue;
            vmData.toFeatureListComponent.dbValue = vmData.toFeatureComponent.dbValue;
        }
    }

    vmData.fromOperator.dbValue = vmData.fromOperatorListValues[0].propDisplayValue;
    vmData.fromOperator.uiValue = vmData.fromOperatorListValues[0].propDisplayValue;
    return {
        typeOfFamily: familyType,
        nameOfFamily: familyDisplayName,
        fromOperator: vmData.fromOperator,
        fromComponentData,
        toOperator: vmData.toOperator,
        toComponentData,
        fromOperatorList: vmData.fromOperatorListValues,
        fromDateFeatureValue: vmData.fromDateFeatureComponent,
        toDateFeatureValue: vmData.toDateFeatureComponent,
        fromFeatureListComponent: vmData.fromFeatureListComponent,
        fromEnumListFeatureValues: vmData.fromEnumListFeatureValues,
        toFeatureListComponent: vmData.toFeatureListComponent,
        showRangeTitle: vmData.showRangeTitle,
        isFreeForm,
        displayValues,
        idValues,
        selectedObject
    };
};

/**
 * Populate VM data to show family name in panel
 * @param {Object} commandCtx - Command context
 */
export let loadFamilyInPanel = async function( commandCtx ) {
    let vmoObj = {};
    let familyStr;
    // From Grids, update view data based on Grid Selection State
    if( commandCtx.sourceID === pca0Constants.GRID_CONSTANTS.VARIANT_CONDITION ) {
        let gridSelectionState = commandCtx.commandContext.gridSelectionState.value;
        familyStr = gridSelectionState.selectionInfo.id;
    } else if( commandCtx.sourceID === 'fscFreeFormRangeExpPanel' ) {
        let cmdCtx = commandCtx.commandContext;
        familyStr = cmdCtx.family.familyStr;
    } else if ( commandCtx.sourceID === veConstants.GRID_CONSTANTS.PCA_GRID ||
        commandCtx.sourceID === veConstants.GRID_CONSTANTS.BOTTOM_CONSTRAINTS_GRID ||
        commandCtx.sourceID === veConstants.GRID_CONSTANTS.MULTIPLE_SVR_GRID_ID ) {
        familyStr = _.get( commandCtx, 'commandContext.vmo.uid' );
    }

    await dataManagementSvc.loadObjects( [ familyStr ] );
    let oUidObject = cdm.getObject( familyStr );
    vmoObj = viewModelObjectService.createViewModelObject( oUidObject );
    return vmoObj;
};

/**
 * Helps to add feature to family list
 * @param {Object} fromOp - From operator component
 * @param {Object} fromValue - From value component
 * @param {Object} toOp - To operator component
 * @param {Object} toValue - To value component
 * @param {Object} fromDateValue - From Date component
 * @param {Object} toDateValue - To Date component
 * @param {Object} fromListValue - From List component
 * @param {Object} toListValue - To list component
 * @param {Object} subPanelContext - SubPanelContext
 * @param {String} familyType - Show type of family
 * @param {Boolean} isFreeForm - FreeForm value
 * @param {Object}  featureVMOs - feature VMOS for enumerated family
 * @param {Object}  parentNode - UID of parent selected object from grid editor
 */
export let addFeatureToFamily = ( fromOp, fromValue, toOp, toValue, fromDateValue, toDateValue, fromListValue, toListValue, subPanelContext, familyType, isFreeForm, featureVMOs, parentNode ) => {
    //const familyInfo = _.get( panelCtx, 'commandContext.family' );
    const localeTextBundle = localeService.getLoadedText( 'ConfiguratorMessages' );
    let vmoSelected = {};
    if ( !_.isUndefined( fromListValue ) && !isFreeForm &&
     ( !isFreeForm && familyType === pca0Constants.FAMILY_VALUE_TYPES[1] || familyType === pca0Constants.FAMILY_VALUE_TYPES[0] )  ) {
        fromValue = fromListValue;
        toValue = toListValue;
    } else if ( familyType === pca0Constants.FAMILY_VALUE_TYPES[2] && !_.isUndefined( fromDateValue ) ) {
        fromValue = fromDateValue;
        toValue = toDateValue;
        if ( subPanelContext.sourceID === veConstants.GRID_CONSTANTS.PCA_GRID ||
            subPanelContext.sourceID === veConstants.GRID_CONSTANTS.BOTTOM_CONSTRAINTS_GRID ||
            subPanelContext.sourceID === veConstants.GRID_CONSTANTS.MULTIPLE_SVR_GRID_ID ||
            subPanelContext.sourceID === 'fscFreeFormRangeExpPanel' ) {
            fromValue = pca0CommonUtils.getFormattedDateString( new Date( fromDateValue ) );
            toValue = pca0CommonUtils.getFormattedDateString( new Date( toDateValue ) );
        }
    }
    let resultValue = fromOp + ' ' + fromValue;

    if ( fromOp === '=' || familyType === pca0Constants.FAMILY_VALUE_TYPES[3] ) {
        resultValue = fromValue;
    } else if ( ( fromOp === '>' || fromOp === '>=' ) && toOp && toValue && toValue !== '' ) {
        resultValue += ' & ' + toOp + ' ' + toValue;
    }

    if ( parentNode && parentNode.nodeUid && !_.isEmpty( featureVMOs ) && fromOp === '=' ) { // it should be defined only when grid editor with integer and float enum range
        vmoSelected = featureVMOs[fromValue];
        vmoSelected.alternateID = parentNode.nodeUid + ':' + vmoSelected.sourceUid;
        vmoSelected.parentUID = parentNode.nodeUid;
        vmoSelected.nodeUid = vmoSelected.sourceUid;
    }
    if( fromValue && toValue && Number( fromValue ) > Number( toValue ) ) {
        messagingService.showError( localeTextBundle.showRangeError );
        return;
    }
    _closeAddFreeFormOptionValuePanel( subPanelContext );
    _notifyValueChange( resultValue, isFreeForm, parentNode, subPanelContext, vmoSelected );
};

/**
 * Updates to enum list values
 * @param {String} fromSelectedValue - UI value of from list component
 * @param {Object} featureListComponent - Enum list component to update data
 * @param {Array} toListValues - Enum list values to update on it
 * @param {String} toOperatorValue - Operator value
 * @param {String} familyType - Type of family
 * @param {Array} displayValues - Display values
 * @param {Array} idValues - Ids for display values
 * @param {String} fromFeatureListComponent - from feature list component VM
 * @param {String} fromOperatorValue - Operator value from operator
 * @param {String} isFromOperatorChanged - is true if from operator value is changed
 * @param {String} isFreeForm - is true if family is free form
 * @returns {Object} Component data to render to list values
 */
export let updateToEnumList = ( fromSelectedValue, featureListComponent, toListValues,
    toOperatorValue, familyType, displayValues, idValues, fromFeatureListComponent, fromOperatorValue, isFromOperatorChanged, isFreeForm ) => {
    featureListComponent.type = _.toUpper( familyType );
    if ( familyType === pca0Constants.FAMILY_VALUE_TYPES[1] ) {
        // floating point
        featureListComponent.type = 'DOUBLE';
    }
    if ( toOperatorValue === '--' ) {
        featureListComponent.uiValue = '';
        featureListComponent.dbValue = '';
    }
    if( isFromOperatorChanged ) {
        // We should not be able to add any custom feature if = operator is selected.
        // Only the features from the drop down can be selected
        if( fromOperatorValue === '=' ) {
            fromFeatureListComponent.isSelectOnly = true;
            // Empty the feature list component in case any of the operator is changed to = operator.
            fromFeatureListComponent.uiValue = '';
            fromFeatureListComponent.dbValue = '';
        } else {
            fromFeatureListComponent.isSelectOnly = false;
        }
    }
    toListValues = [];
    if ( !isFreeForm && ![ pca0Constants.FAMILY_VALUE_TYPES[ 2 ] /* Date */, pca0Constants.FAMILY_VALUE_TYPES[3] /* String */ ].includes( familyType ) ) {
        _updateListValues( toListValues, displayValues, idValues, familyType, fromSelectedValue );
    }
    return {
        featureListComponent,
        toListValues,
        fromFeatureListComponent
    };
};

/**
 * This function should get call only in case of grid editor and for integer and float type range feature
 * @param {Object} eventData - To get viewModelObjectMap from soaResponse
 * @param {string} selectedObject - uid of family
 * @return {Object} Component data
 */
export let updatePanelComponent = ( eventData, selectedObject ) => {
    const viewModelObject = _.get( eventData, 'data.viewModelObjectMap' );
    const featureListValues = [];
    const displayValues = [];
    const idValues = [];
    const featureUids = {};
    //viewModelObject.sort( ( a, b ) => a.displayName - b.displayName );
    _.forEach( viewModelObject, vmo => {
        if ( vmo.sourceUid !== selectedObject.nodeUid ) {
            const objectValues = {
                propDisplayValue: vmo.displayName,
                propInternalValue: vmo.displayName
            };
            featureListValues.push( { ...objectValues } );

            featureUids[vmo.displayName] = vmo; // its required to send data to grid editor
        }
    } );
    featureListValues.sort( ( a, b ) => a.propDisplayValue - b.propDisplayValue );
    featureListValues.forEach( objectData => {
        displayValues.push( objectData.propDisplayValue );
        idValues.push( objectData.propDisplayValue );
    } );

    return {
        featureListValues,
        displayValues,
        idValues,
        featureUids
    };
};

export default exports = {
    initComponentData,
    loadFamilyInPanel,
    addFeatureToFamily,
    updateToEnumList,
    updatePanelComponent
};

