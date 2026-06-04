// Copyright (c) 2022 Siemens

/**
 * @module js/aceEffectivityService
 */
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import cmm from 'soa/kernel/clientMetaModel';
import cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import sharedEffSvc from 'js/sharedEffectivityService';
import dateEffConfigSvc from 'js/dateEffectivityConfigurationService';
var exports = {};

export let updateEndItemWidgetVisibility = function( data, subPanelContext ) {
    if( subPanelContext.occContext && ( data.flag.dbValue === 'AUTHOR' || data.flag.dbValue === 'AUTHORREVISION' ||  data.flag.dbValue === 'EDIT' && subPanelContext.sharedData.unitRangeText.dbValue === null ) ) {
        sharedEffSvc.loadTopLevelAsEndItem( data, subPanelContext );
    }
};

/**
    * Get initial date effectivity configuration
    *
    * @param {Object} data - data
    */
export let getInitialDateEffectivityConfigurationData = function( data, occContext ) {
    var dateTimeInfo = dateEffConfigSvc.getInitialDateEffectivityConfigurationData( data, occContext );
    return { currentEffectiveDate: dateTimeInfo.currentEffectiveDate, isTimeEnabled: dateTimeInfo.isTimeEnabled, dateTimeFormat: dateTimeInfo.dateTimeFormat };
};

/**
    * Validate Unit values
    * @param {Object} data - data
    * @param {Object} sharedData - sharedData
    * @param {Object} unitRangeText - unitRangeText
    */
export let validateAndUpdateUnitValue = function( data, sharedData, unitRangeText, i18n ) {
    var isUnitRangeValid = true;
    var isBadSyntax = false;
    var isPositiveNumber = true;
    var isTooLarge = false;
    var finalFirstNum;

    var unitValue = data.unitRangeText.dbValue;
    if( unitValue ) {
        var clean = unitValue;
        clean = clean.replace( '/\s+/g', '' ); //remove all spaces from the given string

        if( clean !== null && clean !== '' ) {
            var unitInParts = clean.split( ',' );
            var lastValue = -1;
            var i = 0;
            for( i = 0; i < unitInParts.length; i++ ) {
                var units = unitInParts[ i ].split( '-' );

                // if range is given even after UP or SO, lastValue will be NaN
                // pattern like 10-15-20 is invalid
                if( isNaN( lastValue ) ) {
                    isUnitRangeValid = false;
                    break;
                } else if( units.length > 2 ) {
                    isBadSyntax = true;
                    break;
                }

                // CHeck if first number starts with zero.
                var firstNumber = units[ 0 ];

                //var num = Array.from(firstNumber);
                if( units[ 0 ] ) {
                    finalFirstNum = units[ 0 ].trim().replace( /^0+/, '' );
                    if( finalFirstNum === '' ) {
                        finalFirstNum = 0;
                    }
                }

                var isFirstNumberInteger = Number.isInteger( Number( firstNumber ) );

                // check 1st part is number or if it is a negative number
                if( isNaN( units[ 0 ] ) || units[ 0 ] === '' || !isFirstNumberInteger || _.endsWith( units[0], '.' ) ) {
                    isPositiveNumber = false;
                    break;
                } else if( Number( units[ 0 ] ) <= lastValue ) {
                    isUnitRangeValid = false;
                    break;
                } else if( parseInt( units[ 0 ] ) > 2147483647 ) {
                    isTooLarge = true;
                    break;
                }

                lastValue = Number( units[ 0 ] ); // update last value


                // if there is second part
                if( units.length > 1 ) {
                    // check 2nd part is float
                    var secondNumber = units[ 1 ];
                    var isSecondNumberInteger = Number.isInteger( Number( secondNumber ) );

                    // check 1st part is number
                    if( isNaN( units[ 1 ] ) ) {
                        if( units[ 1 ] !== i18n.upTextForUnit && units[ 1 ] !== i18n.soTextForUnit ) {
                            isPositiveNumber = false;
                            break;
                        }
                    } else if( !isSecondNumberInteger || _.endsWith( units[1], '.' ) ) {
                        isPositiveNumber = false;
                        break;
                    } else if( Number( units[ 1 ] ) <= lastValue ) {
                        isUnitRangeValid = false;
                        break;
                    } else if( parseInt( units[ 1 ] ) > 2147483647 ) {
                        isTooLarge = true;
                        break;
                    }

                    //check if it contains leading 0
                    let newUnitValPart1 = secondNumber.replace( /\b0+/g, '' );

                    lastValue = Number( newUnitValPart1 );
                }
            }
        }
        if( !_.includes( unitValue, '-' ) && finalFirstNum === 0 ) {
            isPositiveNumber = false;
        }
    }
    var modifiedUnitRangeText = updateModifiedUnitRangeText( unitValue, sharedData, unitRangeText );
    return {
        isUnitRangeValid : isUnitRangeValid,
        isBadSyntax : isBadSyntax,
        isPositiveNumber : isPositiveNumber,
        isTooLarge : isTooLarge,
        modifiedUnitRangeText : modifiedUnitRangeText
    };
};

/**
* Validate and update Unit values
* @param {Object} unitValue - unitValue
* @param {Object} subPanelContext - subPanelContext
* @param {Object} unitRangeText - unitRangeText
*/
var updateModifiedUnitRangeText = function( unitValue, sharedData, unitRangeText ) {
    let sharedDataValue = { ...sharedData.value };
    let modifiedUnitRangeText;

    //After returning from endItem panel, unitValue will be null as panel re-renders,
    //but if user had entered some value in unit box before going to end item panel than that value will be stored on subPanelContext.
    if( unitValue === null ) {
        modifiedUnitRangeText = sharedDataValue.unitRangeText.dbValue;
    } else {
        modifiedUnitRangeText = unitValue;
    }

    // if unit value starts with 0 then this code will remove leading 0's. this will be removed for single unit value and not unit range.
    if( unitValue !== null && unitValue.length > 1 && ( !_.includes( unitValue, '-' ) && _.includes( unitValue, 0 ) ) ) {
        modifiedUnitRangeText = unitValue.replace( /\b0+/g, '' );
    }

    // First time when panel is launched, "property required" error is displayed on the screen, so "isUnitUpdated" is maintained.
    // "isUnitUpdated" will become true only when user enters some value in unit box.
    if( unitValue === null && sharedDataValue.unitRangeText.dbValue !== null ) {
        sharedDataValue.isUnitUpdated.dbValue = true;
    }

    sharedData.update( { ...sharedDataValue } );
    if( sharedDataValue.isUnitUpdated.dbValue === true || sharedDataValue.isUnitUpdated.dbValue === 'true' ) {
        unitRangeText.update( modifiedUnitRangeText, {}, { markModified : true } );
    }

    return modifiedUnitRangeText;
};

export const setActiveView = ( destinationPanelId, data, subPanelContext, i18n ) => {
    let sharedData = data.sharedData;
    sharedData = clearFields( sharedData, subPanelContext, i18n, data );
    sharedData.isProtected.dbValue = false;
    sharedData.previousView = sharedData.activeView;
    sharedData.activeView = destinationPanelId;
    return sharedData;
};

export const setActiveViewFromEndItem = ( destinationPanelId, sharedData ) => {
    sharedData.previousView = sharedData.activeView;
    sharedData.activeView = destinationPanelId;
    return sharedData;
};

// When shared effectivity is edited then share checkbox will be disabled and
// the name value should be retained on radio button change.
export let updateRadioBtnValueOnState = ( subPanelContext, flag ) => {
    let sharedData = { ...subPanelContext.value };
    var value = sharedData.dateOrUnitEffectivityTypeRadioButton.dbValue;
    if( value ) {
        sharedData.dateOrUnitEffectivityTypeRadioButton.dbValue = false;
        if( flag.dbValue === 'EDIT' && sharedData.isShared.dbValue === true ) {
            sharedData.isSharedForUnit.dbValue = true;
            sharedData.nameBoxForUnit.dbValue = sharedData.nameBox.dbValue;
        }
    } else {
        sharedData.dateOrUnitEffectivityTypeRadioButton.dbValue = true;
        if( flag.dbValue === 'EDIT' && sharedData.isSharedForUnit.dbValue === true ) {
            sharedData.isShared.dbValue = true;
            sharedData.nameBox.dbValue = sharedData.nameBoxForUnit.dbValue;
        }
    }
    subPanelContext.update( { ...sharedData } );
    return sharedData.dateOrUnitEffectivityTypeRadioButton.dbValue;
};

export var clearUnitEffectivityFields = function( data, subPanelContext ) {
    if( subPanelContext.sharedData.dateOrUnitEffectivityTypeRadioButton.dbValue ) {
        let sharedData = subPanelContext.sharedData;
        let sharedDataValue = { ...sharedData.getValue() };
        sharedDataValue.nameBoxForUnit.dbValue = null;
        sharedDataValue.unitRangeText.dbValue = null;
        sharedDataValue.isSharedForUnit.dbValue = false;
        sharedDataValue.isUnitUpdated.dbValue = false;
        sharedData.update( { ...sharedDataValue } );
        updateEndItemWidgetVisibility( data, subPanelContext );
    }
};

export let updateUnitEffectivityStateToDefault = ( sharedDataValue ) => {
    let sharedData = { ...sharedDataValue.getValue() };
    // Set the value of dateOrUnitEffectivityTypeRadioButton
    // 1. If Date effectivity feature is enable-- true
    // 2. If Date effectivity feature is disable and Unit effectivity feature is enable---false
    // 3. If both Date effectivity feature and unit effectivity feature is disable ----- null
    if( sharedData.dateEffectivityEnable.dbValue ) {
        sharedData.dateOrUnitEffectivityTypeRadioButton.dbValue = true;
    }else if( sharedData.unitEffectivityEnable.dbValue ) {
        sharedData.dateOrUnitEffectivityTypeRadioButton.dbValue = false;
    } else{
        sharedData.dateOrUnitEffectivityTypeRadioButton.dbValue = null;
    }
    sharedDataValue.update( { ...sharedData } );
};

let clearFields = function( sharedDataValue, subPanelContext, i18n, data ) {
    //clear unit effectivity fields
    sharedDataValue.nameBoxForUnit.dbValue = null;
    sharedDataValue.unitRangeText.dbValue = null;
    sharedDataValue.isSharedForUnit.dbValue = false;
    sharedDataValue.isUnitUpdated.dbValue = false;
    if( !subPanelContext.occContext ) {
        sharedDataValue.endItemVal.dbValue = null;
        sharedDataValue.endItemVal.uiValue = null;
    }
    if( subPanelContext.occContext && ( data !== undefined && data.flag && data.flag.dbValue ) ) {
        updateEndItemWidgetVisibility( data, subPanelContext );
    }
    //clear date effectivity fields
    sharedDataValue.isShared.dbValue = false;
    sharedDataValue.nameBox.dbValue = null;
    sharedDataValue.startDate.dbValue = null;
    sharedDataValue.endDate.dbValue = null;
    sharedDataValue.endDateOptions.dbValue = 'Date';
    sharedDataValue.endDateOptions.uiValue = i18n.dateEffectivity;
    sharedDataValue.endItemValForDate.dbValue = null;
    sharedDataValue.endItemValForDate.uiValue = null;
    sharedDataValue.endItemValForDate.endItem.uid = null;
    sharedDataValue.endItemValForDate.endItem.type = null;
    return sharedDataValue;
};

export let clearAllEffectivityFields = ( subPanelContext, i18n, data ) => {
    let sharedData = subPanelContext.sharedData;
    let sharedDataValue = { ...sharedData.getValue() };
    let sharedDataValuesNew = clearFields( sharedDataValue, subPanelContext, i18n, data );

    sharedDataValuesNew.isProtected.dbValue = false;
    sharedData.update( { ...sharedDataValuesNew } );
};

export let clearEffectivityFieldsWithoutProtect = ( subPanelContext, i18n, data ) => {
    let sharedData = subPanelContext.sharedData;
    let sharedDataValue = { ...sharedData.getValue() };
    let sharedDataValuesNew = clearFields( sharedDataValue, subPanelContext, i18n, data );

    sharedData.update( { ...sharedDataValuesNew } );
};


export let updateNameBox = ( fields, fieldName, data ) => {
    let nameBoxUpdated = {};
    nameBoxUpdated = { ...data.nameBox };
    let checkBoxVal = fields.isShared.value;

    if( checkBoxVal === true ) {
        nameBoxUpdated.isRequired = true;
        data.dispatch( { path: 'data.nameBox', value: nameBoxUpdated } );
    } else {
        nameBoxUpdated.isRequired = false;
        data.dispatch( { path: 'data.nameBox', value: nameBoxUpdated } );
    }
};

export let updateNameBoxForUnit = ( fields, fieldName, data ) => {
    let nameBoxUpdated = {};
    nameBoxUpdated = { ...data.nameBoxForUnit };
    let checkBoxVal = fields.isSharedForUnit.value;

    if( checkBoxVal === true ) {
        nameBoxUpdated.isRequired = true;
        data.dispatch( { path: 'data.nameBoxForUnit', value: nameBoxUpdated } );
    } else {
        nameBoxUpdated.isRequired = false;
        data.dispatch( { path: 'data.nameBoxForUnit', value: nameBoxUpdated } );
    }
};

export let updateDateWidgetType = ( subPanelContext, data )=> {
    let sharedData = subPanelContext.sharedData;
    let sharedDataValue = { ...sharedData.getValue() };
    if( data.isTimeEnabled ) {
        sharedDataValue.endDate.type = 'DATETIME';
        sharedDataValue.isTimeEnabled.value = true;
    } else{
        sharedDataValue.endDate.type = 'DATE';
        sharedDataValue.isTimeEnabled.value = false;
    }
    sharedData.update( { ...sharedDataValue } );
};

export let updateProtectCheckBoxOnData = ( sharedData, data ) => {
    let protectedValue = { ...data.isProtected };
    protectedValue.dbValue = sharedData.isProtected.dbValue;
    return protectedValue.dbValue;
};

export let updateViewAndCloseEndItemPanel = ( sharedData ) => {
    let sharedDataValue = { ...sharedData.getValue() };
    let previousView = sharedDataValue.previousView;
    if( sharedDataValue.isDateOrUnitEff === true ) {
        sharedDataValue.previousView = 'AuthorEffectivityEndItemPanelDate';
    } else {
        sharedDataValue.previousView = 'AuthorEffectivityEndItemPanel';
    }
    sharedDataValue.activeView = previousView;
    sharedData.update( { ...sharedDataValue } );
};

/**
* Preparing input for "getPreferences2" SOA based on selected object type hierarchy.
* i.e array of "AWBEnabledStructureFeatures_<type>"
* @param {Object} subPanelContext - subPanelContext
* @returns{Object}- return prefNames[]
*/
export let getPreferenceNameInput = function( subPanelContext ) {
    let prefNames = [];
    var selectedObject = subPanelContext.occContext ? subPanelContext.occContext.pwaSelection[0] : null;
    if( !selectedObject && subPanelContext.selectionData && subPanelContext.selectionData.selected ) {
        selectedObject = subPanelContext.selectionData.selected[0];
    } else if( !selectedObject && subPanelContext.selection ) {
        selectedObject = subPanelContext.selection[0];
    } else if( !selectedObject && subPanelContext.selected ) {
        selectedObject = subPanelContext.selected;
    }
    //Get type hierarchy of selected object type
    let items_tag = cdm.getObject( selectedObject.props.items_tag?.dbValues[0] );
    let selectedObjTypeHierarchy = cmm.getType( items_tag.type )?.typeHierarchyArray;
    let prefNamePrefix = 'AWBEnabledStructureFeatures_';
    if( selectedObjTypeHierarchy ) {
        for( let inx = 0; inx < selectedObjTypeHierarchy.length; inx++ ) {
            //Based on object type, create the preference name and added in prefName array
            let itemType = selectedObjTypeHierarchy[inx];
            let prefName = prefNamePrefix + itemType;
            prefNames.push( prefName );
        }
    }

    return [ {
        scope: 'site',
        names: prefNames
    } ];
};

/**
* Get default sharedDataValue for Date and Unit effectivity from "AWBEnabledStructureFeatures_<type>" preference
* when open the panel outside of ACE location
* @param {Object} response - response
* @param {Object} sharedData - sharedData
*/
export let getDateUnitEffSharedStateToDefaultFromPreference = function( response, sharedData ) {
    let enabledEffectivityFeatures = [];
    let sharedDataValue = { ...sharedData.getValue() };
    // We are consuming the preference values for selected object type and which is avaialble in first position.
    // If preference is not available for this object type then consume preference values of its parent type.
    if ( response && response.preferences && response.preferences[0].values && response.preferences[0].values.length > 0 ) {
        enabledEffectivityFeatures = response.preferences[0].values;
        enabledEffectivityFeatures.forEach( function( feature ) {
            if( feature === 'Awb0DateEffectivityConfigFeature' ) {
                sharedDataValue.dateEffectivityEnable.dbValue = true;
            }
            if( feature === 'Awb0UnitEffectivityConfigFeature' ) {
                sharedDataValue.unitEffectivityEnable.dbValue = true;
            }
        } );
        sharedData.update( { ...sharedDataValue } );
    }
};

/**
* Get default sharedDataValue for Date and Unit effectivity from PCI supportedFeatures
* when open the panel from ACE location
* @param {Object} subPanelContext - subPanelContext
*/
export let getDateUnitEffSharedStateToDefaultFromPCI = function( subPanelContext ) {
    let sharedData = { ...subPanelContext.sharedData.getValue() };
    if( subPanelContext.occContext && subPanelContext.occContext.supportedFeatures ) {
        if( subPanelContext.occContext.supportedFeatures.Awb0DateEffectivityConfigFeature ) {
            sharedData.dateEffectivityEnable.dbValue = true;
        }
        if( subPanelContext.occContext.supportedFeatures.Awb0UnitEffectivityConfigFeature ) {
            sharedData.unitEffectivityEnable.dbValue = true;
        }
        subPanelContext.sharedData.update( { ...sharedData } );
    }
};

/**
* Get default sharedDataValue for Date and Unit effectivity from PCI supportedFeatures
* when open the panel from ACE location
* @param {Object} sharedData - sharedData
* @param {Object} toolTipMessages - toolTipMessages
* @returns{Object}- return tooltip
*/
export let getEffectctivityToolTipMessage = function( sharedData, toolTipMessages ) {
    let tooltip;
    if( sharedData.dateEffectivityEnable.dbValue && sharedData.unitEffectivityEnable.dbValue ) {
        tooltip = toolTipMessages[0];
    }else if( sharedData.dateEffectivityEnable.dbValue ) {
        tooltip = toolTipMessages[1];
    }else if( sharedData.unitEffectivityEnable.dbValue ) {
        tooltip = toolTipMessages[2];
    }
    return tooltip;
};

export let saveElementEffectivity = function( selected, operationType ) {
    let eventName;
    switch( operationType ) {
        case 'AUTHOR' :
            eventName = 'saveEventForElemEffAuthor';
            break;
        case 'EDIT' :
            eventName = 'saveEventForElemEffEdit';
            break;
        case 'REMOVE' :
            eventName = 'saveEventForElemEffRemove';
            break;
        default:
            break;
    }

    if( appCtxSvc.getCtx( 'elementEffectivity.enablePreSaveHookForElemEff' ) ) {
        // get uids of selected elements
        let elementsUid = [];
        selected.forEach( function( selectedElement ) {
            elementsUid.push( selectedElement.uid );
        } );

        var eventData = {
            eventName: eventName,
            selectedElementUids: elementsUid
        };
        eventBus.publish( 'preSaveEventForElemEff', eventData );
        return;
    }
    eventBus.publish( eventName );
};

export let updatePreviousSelectedUid = ( currentSelectedUid, data, subPanelContext ) => {
    var selectedObject = subPanelContext.occContext ? subPanelContext.occContext.pwaSelection : [];
    if( selectedObject.length === 0 && subPanelContext.selectionData && subPanelContext.selectionData.selected && subPanelContext.selectionData.selected.length > 0 ) {
        selectedObject = subPanelContext.selectionData.selected;
    } else if( selectedObject.length === 0 && subPanelContext.selection ) {
        selectedObject = subPanelContext.selection;
    }
    if( selectedObject.length > 0 ) {
        data.dispatch( { path: 'data.previousSelectedUid', value: currentSelectedUid } );
        data.dispatch( { path: 'data.previousSelectionLength', value: selectedObject.length } );
    }
};

export default exports = {
    updateEndItemWidgetVisibility,
    getInitialDateEffectivityConfigurationData,
    validateAndUpdateUnitValue,
    setActiveView,
    updateRadioBtnValueOnState,
    updateUnitEffectivityStateToDefault,
    updateNameBox,
    updateNameBoxForUnit,
    updateDateWidgetType,
    clearUnitEffectivityFields,
    updateProtectCheckBoxOnData,
    updateViewAndCloseEndItemPanel,
    getDateUnitEffSharedStateToDefaultFromPreference,
    getDateUnitEffSharedStateToDefaultFromPCI,
    getPreferenceNameInput,
    getEffectctivityToolTipMessage,
    updatePreviousSelectedUid,
    clearAllEffectivityFields,
    clearEffectivityFieldsWithoutProtect,
    setActiveViewFromEndItem,
    saveElementEffectivity
};
