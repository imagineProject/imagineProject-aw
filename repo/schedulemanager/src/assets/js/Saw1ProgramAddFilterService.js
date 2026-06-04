// Copyright (c) 2022 Siemens

/**
 * @module js/Saw1ProgramAddFilterService
 */
import appCtxService from 'js/appCtxService';
import smConstants from 'js/ScheduleManagerConstants';
import soaSvc from 'soa/kernel/soaService';
import dateTimeSvc from 'js/dateTimeService';
import AwPromiseService from 'js/awPromiseService';
import eventBus from 'js/eventBus';
import _ from 'lodash';

var exports = {};

var _editCondition = null;

var finalStatusResponse = [];

var _resetEditWidgets = false;

/**
 * Populate Priorities from soa call
 *
 * @param {ctx} ctx - The context of view model
 * @param {data} data - The data of view model
 * @returns {response} response of SOA
 */
export let getPriorities = function( response, genericVals, genericEndValsContx, genericEndVal, i18n ) {
    let newGenericVals = _.clone( genericVals );
    let newGenericEndValsContx = _.clone( genericEndValsContx );
    let newGenericEndVal = _.clone( genericEndVal );
    for( let i = 0; i < response.lovValues.length; i++ ) {
        response.lovValues[ i ].propDisplayValues.lov_value_descriptions[ 0 ];
        newGenericVals.dbValues[ i ] = [];
        newGenericVals.dbValues[ i ].propDisplayValue = response.lovValues[ i ].propDisplayValues.lov_value_descriptions[ 0 ];
        newGenericVals.dbValues[ i ].propInternalValue = response.lovValues[ i ].propDisplayValues.lov_values[ 0 ];
    }
    newGenericVals.dbValue = _.clone( newGenericVals.dbValues );
    newGenericEndValsContx.dbValue = _.clone( newGenericVals.dbValues );
    newGenericEndValsContx.dbValues = _.clone( newGenericVals.dbValues );

    appCtxService.updateCtx( 'ProgramViewPriorities', newGenericVals.dbValues );
    newGenericEndVal.propertyDisplayName = i18n.to;
    return {
        genVals: newGenericVals,
        genericEndContx: newGenericEndValsContx,
        genEndVal: newGenericEndVal
    };
};

/**
 * Populate States from soa call
 *
 * @param {ctx} ctx - The context of view model
 * @param {data} data - The data of view model
 * @param {object} internalName - Internal name of field selected
 * @returns {response} response of SOA
 */
export let getState = function( response, genericVals, genericValsContx, propConext, internalName ) {
    let newGenericVal = _.clone( genericVals );
    let newGenericValsContx = _.clone( genericValsContx );
    let propertyConext = _.clone( propConext );
    for( let i = 0; i < response.lovValues.length; i++ ) {
        response.lovValues[ i ].propDisplayValues.lov_value_descriptions[ 0 ];
        newGenericVal.dbValues[ i ] = [];
        newGenericVal.dbValues[ i ].propDisplayValue = response.lovValues[ i ].propDisplayValues.lov_values[ 0 ];
        newGenericVal.dbValues[ i ].propInternalValue = response.lovValues[ i ].propInternalValues.lov_values[ 0 ];
    }
    newGenericVal.dbValue = _.clone( newGenericVal.dbValues );

    appCtxService.updateCtx( 'ProgramViewStates', newGenericVal.dbValues );
    newGenericValsContx.propertyDisplayName = propertyConext.uiValue;
    return {
        genericVals: newGenericVal,
        genericValsContx: newGenericValsContx,
        propertyCon: propertyConext
    };
};

export let updateExistingStates = function( response ) {
    let resStates = [];
    for( let i = 0; i < response.lovValues.length; i++ ) {
        response.lovValues[ i ].propDisplayValues.lov_value_descriptions[ 0 ];
        resStates.push(
            {
                propDisplayValue : response.lovValues[ i ].propDisplayValues.lov_values[ 0 ],
                propInternalValue : response.lovValues[ i ].propInternalValues.lov_values[ 0 ]

            }
        );
    }
    appCtxService.updateCtx( 'ProgramViewStates', resStates );
};

/**
 * Populate Status from soa call
 *
 * @param {index} index - The index of ProgramViewStates array
 * @param {ctx} ctx - The context of view model
 * @param {data} data - The data of view model
 * @returns {response} response of SOA
 */

export let getStatus = function( index,  genericValueContextValues, genericValueContext, propertyContext ) {
    if( appCtxService.ctx.ProgramViewStates ) {
        let length = appCtxService.ctx.ProgramViewStates.length;
        for( let i = index; i < length; i++ ) {
            let inputData = {
                initialData: {
                    lovInput: {
                        owningObject: {
                            uid: 'AAAAAAAAAAAAAA',
                            type: 'unknownType'
                        },
                        boName: 'Schedule',
                        operationName: 'Edit',
                        propertyValues: {
                            fnd0state: [
                                appCtxService.ctx.ProgramViewStates[ i ].propInternalValue
                            ],
                            fnd0status: [ '' ]
                        }
                    },
                    propertyName: 'fnd0status',
                    filterData: {
                        maxResults: 0,
                        numberToReturn: 25,
                        order: 1
                    }
                }
            };
            return soaSvc.post( 'Core-2013-05-LOV', 'getInitialLOVValues', inputData ).then( function( response ) {
                if( i < length ) {
                    finalStatusResponse.push( response );
                }
                if( i + 1 === length ) {
                    let newGenVals = _.clone( genericValueContextValues );
                    let newGenValsContx = _.clone( genericValueContext );
                    let count = 0;
                    for(const element of finalStatusResponse) {
                        for( let k = 0; k < element.lovValues.length; k++ ) {
                            element.lovValues[ k ].propDisplayValues.lov_value_descriptions[ 0 ];
                            newGenVals.dbValues[ count ] = [];
                            newGenVals.dbValues[ count ].propDisplayValue = element.lovValues[ k ].propDisplayValues.lov_values[ 0 ];
                            newGenVals.dbValues[ count++ ].propInternalValue = element.lovValues[ k ].propInternalValues.lov_values[ 0 ];
                        }
                    }
                    newGenVals.dbValue = _.clone( newGenVals.dbValues );
                    appCtxService.updateCtx( 'ProgramViewStatus', newGenVals.dbValues );
                    newGenValsContx.propertyDisplayName = propertyContext.uiValue;
                    return{
                        genericVals : newGenVals,
                        genericValsContx : newGenValsContx
                    };
                }
                return getStatus( i + 1, genericValueContextValues, genericValueContext, propertyContext );
            } );
        }
    }
};

var resetWidgets = function( genericWidget, genericEndWidget, genericValueContextValues, filterResourceValue ) {
    if( genericWidget ) {
        genericWidget.dbValue = null;
        genericWidget.dispValue = null;
        genericWidget.displayValues = [];
        genericWidget.uiValue = null;
    }
    if( genericEndWidget ) {
        genericEndWidget.dbValue = null;
        genericEndWidget.dispValue = null;
        genericEndWidget.displayValues = [];
        genericEndWidget.uiValue = null;
    }
    resetListBox( genericValueContextValues );
    exports.removeResource( filterResourceValue );
};

var resetListBox = function( genericContextVal ) {
    genericContextVal.dbValues = [];
    genericContextVal.dbValue = null;
    genericContextVal.uiValues = [];
    genericContextVal.uiValue = null;
};

/**
 * Populate condition types based on panel field selection
 *
 * @param {data} data - The data of view model
 * @param {object} conditions - The conditions to be assigned
 */
var populateConditionTypes = function( data, conditions, newOperatorTypeContextValues ) {
    let listData = [];
    for( let i = 0; i < conditions.length; i++ ) {
        let listValue = {
            propInternalValue: conditions[ i ],
            propDisplayValue: data.i18n[ smConstants.PROGRAM_VIEW_CRITERIA_i18n_KEY_MAP[ conditions[ i ] ] ]
        };
        listData.push( listValue );
    }
    newOperatorTypeContextValues.dbValue = listData;
};

/**
 * Populate Priorities from soa call or ctx
 *
 * @param {ctx} ctx - The context of view model
 * @param {data} data - The data of view model
 */
let populatePriorties = function(  genericContextVal, genericEndValueContextVals ) {
    resetListBox( genericContextVal );
    if( !appCtxService.ctx.ProgramViewPriorities ) {
        return true;
    }
    populatePriortiesFromCtx( genericContextVal, genericEndValueContextVals );
};
/**
 * Populate Priorities from ctx
 *
 * @param {ctx} ctx - The context of view model
 * @param {data} data - The data of view model
 */
var populatePriortiesFromCtx = function(  genericContextVal, genericEndValueContextVals ) {
    genericContextVal.dbValues = _.clone( appCtxService.ctx.ProgramViewPriorities );
    genericContextVal.dbValue = genericContextVal.dbValues;
    genericEndValueContextVals.dbValues = _.clone( appCtxService.ctx.ProgramViewPriorities );
    genericEndValueContextVals.dbValue = genericEndValueContextVals.dbValues;
};
/**
 * Populate States from ctx
 *
 * @param {ctx} ctx - The context of view model
 * @param {data} data - The data of view model
 */
var populateStatesFromCtx = function( genericValueContextValues, genericValueContext, propertyContext ) {
    genericValueContextValues.dbValues = _.clone( appCtxService.ctx.ProgramViewStates );
    genericValueContextValues.dbValue = genericValueContextValues.dbValues;
    genericValueContext.propertyDisplayName = propertyContext.uiValue;
};
/**
 * Populate Status from ctx
 *
 * @param {ctx} ctx - The context of view model
 * @param {data} data - The data of view model
 */
var populateStatusFromCtx = function( genericValueContextValues, genericValueContext, propertyContext ) {
    genericValueContextValues.dbValues = _.clone( appCtxService.ctx.ProgramViewStatus );
    genericValueContextValues.dbValue = genericValueContextValues.dbValues;
    genericValueContext.propertyDisplayName = propertyContext.uiValue;
};
/**
 * Populate State or Status from soa call ot ctx
 *
 * @param {ctx} ctx - The context of view model
 * @param {data} data - The data of view model
 */
let populateStateOrStatus = function( genericValueContextValues, genericValueContext, propertyContext ) {
    let internalName = propertyContext.dbValue.split( '.' )[ 1 ];
    resetListBox( genericValueContextValues );
    if( internalName === 'fnd0state' ) {
        if( !appCtxService.ctx.ProgramViewStates ) {
            return {
                value: 'state',
                isSoaCallReq:true
            };
        }
        populateStatesFromCtx(  genericValueContextValues, genericValueContext, propertyContext );
    } else if( internalName === 'fnd0status' ) {
        let returnValue = '';
        if( !appCtxService.ctx.ProgramViewStates ) {
            returnValue = 'state';
        }

        if( !appCtxService.ctx.ProgramViewStatus ) {
            returnValue += 'status';
            return {
                value: returnValue,
                isSoaCallReq:true
            };
        }
        populateStatusFromCtx( genericValueContextValues, genericValueContext, propertyContext ); // Populate existing cached status from the Ctx.
    }
};


var getInternalValue = function( data, ctx ) {
    for( let i = 0; i < data.ProgramViewFiltersConditions.length; i++ ) {
        if( data.ProgramViewFiltersConditions[ i ].uid === ctx.ProgramViewFilterConditonForEdit.uid ) {
            return data.ProgramViewFiltersConditions[ i ].internalValue;
        }
    }
    return;
};

/**
 * Edit Functionality : Sets the other Widget on the edit Panel
 *
 * @param {ctx} ctx - The context of view model
 * @param {data} data - The data of view model
 * @param {widget} widget - The current active widget of view model
 * @param {endWidget} endWidget - The current active End widget of view model
 */
var setGenericBoxes = function( ctx, data, widget, endWidget ) {
    let fieldValue = ctx.ProgramViewFilterConditonForEdit.cellProperties.Value.value;
    let localisedTo = ' ' + data.i18n.to + ' ';

    if( fieldValue ) {
        let endValue = null;
        endValue = fieldValue.split( localisedTo )[ 1 ];

        let startValue = null;
        let internalValue = null;
        if( widget.type === 'LISTBOX' ) {
            internalValue = getInternalValue( data, ctx );
        }
        if( endValue ) {
            startValue = fieldValue.split( localisedTo )[ 0 ];
            if( widget.type === 'LISTBOX' ) {
                endWidget.dbValue = internalValue.split( ',' )[ 1 ];
            } else {
                endWidget.dbValue = endValue;
            }
            endWidget.uiValue = endValue;
        } else {
            startValue = fieldValue;
        }

        if( startValue ) {
            if( widget.type === 'BOOLEAN' ) { // to support boolean data type
                widget.dbValue = startValue === 'true';
            } else if( widget.type === 'LISTBOX' ) {
                widget.dbValue = endValue ? internalValue.split( ',' )[ 0 ] : internalValue;
            } else {
                widget.dbValue = startValue;
            }
            widget.uiValue = widget.propertyName === 'filterResourceValue' && widget.dbValue === 'Unassigned' ? data.i18n.Saw1Unassigned : startValue;
            widget.dbValue = widget.uiValue;
            widget.dispValue = widget.uiValue;
        }
    }
};
/**
 * Edit Functionality : Sets the Date Widget on the edit Panel
 *
 * @param {ctx} ctx - The context of view model
 * @param {data} data - The data of view model
 */
var setDates = function( genericWid, genericEndWid, i18n ) {
    let fieldValue = appCtxService.ctx.ProgramViewFilterConditonForEdit.cellProperties.Value.value;
    let localisedTo = ' ' + i18n.to + ' ';

    if( fieldValue ) {
        let endDate = fieldValue.split( localisedTo )[ 1 ];
        let startDate = null;
        if( endDate ) {
            endDate = Date.parse( endDate );
            startDate = fieldValue.split( localisedTo )[ 0 ];
            startDate = Date.parse( startDate );

            genericEndWid.dbValue = endDate;
            genericEndWid.uiValue = endDate;
            genericEndWid.dateApi.dateValue = dateTimeSvc.formatDate( endDate, genericEndWid.dateApi.dateFormatPlaceholder );
        } else {
            startDate = Date.parse( fieldValue );
        }

        if( startDate ) {
            genericWid.dbValue = startDate;
            genericWid.uiValue = startDate;
            genericWid.dateApi.dateValue = dateTimeSvc.formatDate( startDate, genericEndWid.dateApi.dateFormatPlaceholder );
        }
    }
};

/**
 * Condition Context handling on Panel
 *
 * @param {data} data - The data of view model
 */
let selectionChangeOfOperator = function( propContext, newWidget, newOperatorTypeContext, newCurrentConditionValueType, newGenericEndWidget, newGenericValueContext, i18n ) {
    if( newOperatorTypeContext.dbValue ) {
        if( newOperatorTypeContext.dbValue.toLowerCase() === 'between' ) {
            newCurrentConditionValueType.dbValue = 'true';

            let internalName = propContext.dbValue.split( '.' )[ 1 ];
            let widgetType = smConstants.PROGRAM_VIEW_WIDGET_TYPE_LIST[ internalName ];
            if( widgetType ) {
                if( widgetType !== 'LISTBOX' ) {
                    newGenericEndWidget.type = widgetType;
                    if( newGenericEndWidget.dbValue < 0 ) {
                        newGenericEndWidget.dbValue = null;
                    }
                } else {
                    newGenericValueContext.propertyDisplayName = i18n.from;
                }
                newCurrentConditionValueType.dbValue = widgetType;
            } else {
                newGenericEndWidget.type = newWidget.type;
                newGenericValueContext.propertyDisplayName = i18n.from;
                newCurrentConditionValueType.dbValue = newWidget.type;
            }
            newWidget.propertyDisplayName = i18n.from;
        } else {
            newCurrentConditionValueType.dbValue = undefined;
            newWidget.propertyDisplayName = propContext.uiValue;
            newGenericValueContext.propertyDisplayName = propContext.uiValue;
        }
    }
};

export let populateTypeNames = function( typeInternalName, ctx,  propertyContextValues, propValue ) {
    const newPropDisplayValues = _.clone( propValue );
    const newPropContextLOVValues = _.clone( propertyContextValues );

    newPropDisplayValues.dbValue = '';
    newPropDisplayValues.dbValues = [];
    newPropDisplayValues.uiValue = '';
    newPropDisplayValues.uiValues = [];
    newPropContextLOVValues.dbValue = '';
    newPropContextLOVValues.dbValues = [];
    newPropContextLOVValues.uiValue = '';
    newPropContextLOVValues.uiValues = [];

    if( typeInternalName && ctx.ProgramViewFilterConditonForEdit ) {
        displayPropertyPreferencesAction( typeInternalName, ctx, newPropContextLOVValues, newPropDisplayValues );
        return {
            lovValues: newPropContextLOVValues,
            displayValue: newPropDisplayValues,
            isPrevPropRetained: true
        };
    }
    if( typeInternalName && ctx.ProgramViewPreferenceMap ) {
        let updatedArr = [];
        let properties = ctx.ProgramViewPreferenceMap[ typeInternalName ];
        if( properties ) {
            let prefProperties = ctx.ProgramViewPropertiesMap[ typeInternalName ];
            for( let j = 0; j < properties.length; j++ ) {
                for( let k = 0; k < prefProperties.length; k++ ) {
                    if( prefProperties[ k ].name === properties[ j ] ) {
                        updatedArr.push( {
                            propDisplayValue : prefProperties[ k ].displayName,
                            propInternalValue : typeInternalName + '.' + prefProperties[ k ].name,
                            valueType : prefProperties[ k ].valueType
                        } );
                        break;
                    }
                }
            }
        }
        newPropContextLOVValues.dbValue = updatedArr;
        return {
            lovValues: newPropContextLOVValues,
            displayValue: newPropDisplayValues
        };
    }
};
export let selectionChangeOfTypeContext = function( typeContext, data, feilds ) {
    return exports.populateTypeNames( typeContext, appCtxService.ctx, data, feilds );
};

let clearOperatorValue = function( operatorVal ) {
    operatorVal.dbValue = '';
    operatorVal.uiValue = '';
};

/**
 * Selection change event for Changed Field Value on Panel
 *
 * @param {data} data - The data of view model
 */
export let propUpdated = ( data, widget, crtField, oprType, oprTypeCon, crtCondnValue, endWidget, valCon, genValContValues, genEndValueContVals, genericEndValueContext, resourceVal, propertyContext )=>{
    const newWidget = _.clone( widget );
    const newcurrentFieldValueType = _.clone( crtField );
    const newOperatorTypeContextValues = _.clone( oprType );
    const newOperatorTypeContext = _.clone( oprTypeCon );
    const newCurrentConditionValueType = _.clone( crtCondnValue );
    const newGenericEndWidget = _.clone( endWidget );
    const newGenericValueContext = _.clone( valCon );
    const newGenValueContextValues = _.clone( genValContValues );
    const newGenericEndValueContextVals = _.clone( genEndValueContVals );
    const newGenericEndValueContext = _.clone( genericEndValueContext );
    const newFilterResourceVal = _.clone( resourceVal );
    const newPropContext = _.clone( propertyContext );
    let ctx = appCtxService.ctx;
    let callPrioritySoa;
    let callSoaToFetchValue;

    if( newPropContext.dbValue ) {
        var valueType = null;
        for( let j = 0; j < data.propertyContextValues.dbValue.length; j++ ) {
            if( newPropContext.dbValue === data.propertyContextValues.dbValue[ j ].propInternalValue ) {
                valueType = data.propertyContextValues.dbValue[ j ].valueType;
                break;
            }
        }
        if( valueType !== null && valueType >= 0 ) {
            let conditions = smConstants.PROGRAM_VIEW_CONDITIONS_LIST[ valueType ];
            if( !conditions ) { //default conditions to support newly added value in RAC for ProgramViewFilterProperties
                conditions = [];
                conditions.push( 'Equal To' );
                conditions.push( 'Not Equal To' );
            }
            let internalName = newPropContext.dbValue.split( '.' )[ 1 ];
            let widgetType = smConstants.PROGRAM_VIEW_WIDGET_TYPE_LIST[ internalName ];
            if( widgetType ) {
                if( widgetType !== 'LISTBOX' && widgetType !== 'PANEL' ) {
                    newWidget.type = widgetType;
                    newWidget.propertyDisplayName = newPropContext.uiValue;
                }
            } else {
                widgetType = smConstants.PROGRAM_VIEW_VALUE_TYPE_TO_WIDGET_TYPE_LIST[ valueType ]; //fetch the widgetType to support newly added value in RAC for ProgramViewFilterProperties
                newWidget.type = widgetType;
                newWidget.propertyDisplayName = newPropContext.uiValue;
            }
            newcurrentFieldValueType.dbValue = widgetType;
            clearOperatorValue( newOperatorTypeContext );
            populateConditionTypes(  data, conditions, newOperatorTypeContextValues );
            selectionChangeOfOperator( newPropContext, newWidget, newOperatorTypeContext, newCurrentConditionValueType, newGenericEndWidget, newGenericValueContext, data.i18n );

            if( internalName === 'priority' ) {
                callPrioritySoa = populatePriorties( newGenValueContextValues, newGenericEndValueContextVals );
                _resetEditWidgets = false;
            } else if( internalName === 'fnd0state' || internalName === 'fnd0status' ) {
                callSoaToFetchValue = populateStateOrStatus( newGenValueContextValues, newGenericValueContext, newPropContext );
                _resetEditWidgets = false;
            } else {
                resetWidgets( newWidget, newGenericEndWidget, newGenValueContextValues, newFilterResourceVal );
            }
        }

        if( ctx.ProgramViewFilterConditonForEdit ) {
            // if ( _resetEditWidgets ) {
            //     resetWidgets( data );
            //     ctx.ProgramViewFilterConditonForEdit.cellProperties.Value.value = '';
            // } else {
            if( newcurrentFieldValueType.dbValue === 'LISTBOX' ) {
                setGenericBoxes( ctx, data, newGenericValueContext, newGenericEndValueContext );
            } else if( newcurrentFieldValueType.dbValue === 'DATE' ) {
                setDates(  newWidget, newGenericEndWidget, data.i18n );
            } else if( newcurrentFieldValueType.dbValue !== 'PANEL' ) {
                setGenericBoxes( ctx, data, newWidget, newGenericEndWidget );
            } else if ( newcurrentFieldValueType.dbValue === 'PANEL' ) {
                setGenericBoxes( ctx, data, newFilterResourceVal, newGenericEndWidget );
            }
            // _resetEditWidgets = true;
            // }
        }
        return {
            widget: newWidget,
            feildType: newcurrentFieldValueType,
            operatorContextValues: newOperatorTypeContextValues,
            operatorValues: newOperatorTypeContext,
            conditionValueType: newCurrentConditionValueType,
            genWidget: newGenericEndWidget,
            genValueContext: newGenericValueContext,
            genValueContextVals: newGenValueContextValues,
            genEndValueContextVals: newGenericEndValueContextVals,
            isSoaCallNeeded: callPrioritySoa,
            genEndVal: newGenericEndValueContext,
            resourceVal: newFilterResourceVal,
            stateOrStatusSoa: callSoaToFetchValue,
            propContext: newPropContext
        };
    }
};

/**
 * Display the property preferences , It would populate the field names for Panel
 *
 * @param {object} typeInternalName - The type internal name
 * @param {ctx} ctx - The ctx of the viewModel
 * @param {data} data - The qualified data of the viewModel
 */
export let displayPropertyPreferencesAction = function( typeInternalName, ctx, propContext, propVal ) {
    if( typeInternalName ) {
        let count = 0;
        let properties = ctx.ProgramViewPreferenceMap[ typeInternalName ];
        if( properties ) {
            let prefProperties = ctx.ProgramViewPropertiesMap[ typeInternalName ];
            for( let j = 0; j < properties.length; j++ ) {
                for( let k = 0; k < prefProperties.length; k++ ) {
                    if( prefProperties[ k ].name === properties[ j ] ) {
                        let edit = ctx.ProgramViewFilterConditonForEdit;
                        if( edit && edit.cellProperties.Property.internalValue.split( '.' )[ 1 ] === prefProperties[ k ].name ) {
                            propVal.dbValue = typeInternalName + '.' + prefProperties[ k ].name;
                            propVal.uiValue = prefProperties[ k ].displayName;
                        }
                        propContext.dbValues[ count ] = [];
                        propContext.dbValues[ count ].propDisplayValue = prefProperties[ k ].displayName;
                        propContext.dbValues[ count ].propInternalValue = typeInternalName + '.' + prefProperties[ k ].name;
                        propContext.dbValues[ count ].valueType = prefProperties[ k ].valueType;
                        count++;
                        break;
                    }
                }
            }
        }
        propContext.dbValue = propContext.dbValues;
    }
};

export const updateTypePropMap = ( preferenceResult ) => {
    if( preferenceResult ) {
        let preferenceProp = preferenceResult.response[ 0 ].values.values;
        let objs = [];
        appCtxService.registerCtx( 'ProgramViewPreferenceMap',  {} );
        for( let i = 0; i < preferenceProp.length; i++ ) {
            let objName = preferenceProp[ i ].split( '.' )[ 0 ];
            let propertyName = preferenceProp[ i ].split( '.' )[ 1 ];
            let indexOfObj = objs.indexOf( objName );

            if( indexOfObj === -1 ) {
                objs.push( objName );
            }
            let map = appCtxService.getCtx( 'ProgramViewPreferenceMap' );
            if( map[ objName ] === undefined ) {
                map[ objName ] = [];
            }
            map[ objName ].push( propertyName );
        }
        return objs;
    }
};

export const processPropDesc = ( descResult, noDisplay, objs, data, feilds ) => {
    if( descResult && descResult.types ) {
        appCtxService.registerCtx( 'ProgramViewTypesMap', {} );
        appCtxService.registerCtx( 'ProgramViewPropertiesMap', {} );
        for( let k = 0; k < descResult.types.length; k++ ) {
            let ProgramViewTypesMap = appCtxService.getCtx( 'ProgramViewTypesMap' );
            ProgramViewTypesMap[ descResult.types[ k ].name ] = descResult.types[ k ].displayName;
            let ProgramViewPropertiesMap = appCtxService.getCtx( 'ProgramViewPropertiesMap' );
            ProgramViewPropertiesMap[ descResult.types[ k ].name ] = descResult.types[ k ].propertyDescriptors;
        }
    }
};

/**
 * Get the property preferences configured in RAC for ProgramViewFilterProperties
 *
 * @param {object} typeInternalName - The type internal name
 * @param {ctx} ctx - The ctx of the viewModel
 * @param {data} data - The qualified data of the viewModel
 * @param {boolean} noDisplay - true/false
 */
export let getPropertyPreferences = function( typeInternalName, ctx, data, noDisplay ) {
    _resetEditWidgets = false;
    if( !ctx.ProgramViewPreferenceMap ) {
        soaSvc.postUnchecked( 'Administration-2012-09-PreferenceManagement', 'getPreferences', {
            preferenceNames: [ 'ProgramViewFilterProperties' ],
            includePreferenceDescriptions: true
        } ).then( function( preferenceResult ) {
            if( preferenceResult ) {
                let preferenceProp = preferenceResult.response[ 0 ].values.values;
                let objs = [];
                ctx.ProgramViewPreferenceMap = {};
                for( let i = 0; i < preferenceProp.length; i++ ) {
                    let objName = preferenceProp[ i ].split( '.' )[ 0 ];
                    let propertyName = preferenceProp[ i ].split( '.' )[ 1 ];
                    let indexOfObj = objs.indexOf( objName );

                    if( indexOfObj === -1 ) {
                        objs.push( objName );
                    }
                    if( ctx.ProgramViewPreferenceMap[ objName ] === undefined ) { ctx.ProgramViewPreferenceMap[ objName ] = []; }
                    ctx.ProgramViewPreferenceMap[ objName ].push( propertyName );
                }
                soaSvc.postUnchecked( 'Core-2015-10-Session', 'getTypeDescriptions2', {
                    typeNames: objs,
                    options: {}
                } ).then( function( descResult ) {
                    if( descResult.types ) {
                        ctx.ProgramViewTypesMap = {};
                        ctx.ProgramViewPropertiesMap = {};
                        for( let k = 0; k < descResult.types.length; k++ ) {
                            ctx.ProgramViewTypesMap[ descResult.types[ k ].name ] = descResult.types[ k ].displayName;
                            ctx.ProgramViewPropertiesMap[ descResult.types[ k ].name ] = descResult.types[ k ].propertyDescriptors;
                        }
                        if( noDisplay ) {
                            exports.displayPropertyPreferencesAction( objs[ 0 ], ctx, data );
                        }
                    }
                } );
            }
        } );
    } else if( noDisplay ) {
        exports.displayPropertyPreferencesAction( typeInternalName, ctx, data );
    }
};

/**
 * check for 'Work Complete Percent' value criteria
 *
 * @param {data} data - The current data of the viewModel
 * @param {object} genericWidget - The current active widget
 * @returns {boolean} true/false
 */
var checkForWorkCompletePercentCriteria = function( data, genericWidget ) {
    if( data.currentFieldValueType.dbValue === 'DOUBLE' && data.propertyContext.dbValue.split( '.' )[ 1 ] === 'complete_percent' ) {
        if( genericWidget.dbValue <= 100 && genericWidget.dbValue >= 0 ) {
            return false;
        }
        eventBus.publish( 'Saw1ProgramViewFilter.workCompletePercentError' );
        return true;
    }
    return false;
};

/**
 * check for value Widget Empty or Not .
 *
 * @param {data} data - The current data of view model
 * @param {object} genericWidget - The current active widget
 * @returns {boolean} true/false
 */
var checkWidgetEmptyOrNot = function( data, genericWidget ) {
    if( genericWidget.type === 'DATE' ) {
        if( genericWidget.dbValue > 0 ) {
            return false;
        }
    } else if( genericWidget.dbValue || genericWidget.dbValue === 0 || genericWidget.dbValue === false ) { // false is added to support boolean type
        return false;
    }
    eventBus.publish( 'Saw1ProgramViewFilter.fieldsEmptyError' );
    return true;
};

var calculateHoursValue = function( hoursStringdbValue, duration ) {
    let hoursValue = '';
    let len = hoursStringdbValue.length;
    if( duration === 'w' ) {
        hoursValue = hoursStringdbValue.substring( 0, len - 1 ) * 5 * 8;
    } else if( duration === 'd' ) {
        hoursValue = hoursStringdbValue.substring( 0, len - 1 ) * 8;
    } else if( duration === 'h' ) {
        hoursValue = hoursStringdbValue.substring( 0, len - 1 );
    } else if( duration === 'mo' ) {
        hoursValue = hoursStringdbValue.slice( 0, -2 ) * 20 * 8;
    }
    return hoursValue;
};
/**
 * Calculate and return the value of the work effort.
 *
 * @param {string} hoursStringdbValue - Value of the Work Effort in the Add Schedule Task panel
 * @returns {boolean} true/false
 */
var getHoursValue = function( hoursStringdbValue ) {
    let len = hoursStringdbValue.length;
    let duration = hoursStringdbValue.slice( -1 ).toLowerCase();

    if( duration === 'h' || duration === 'd' || duration === 'w' ) {
        if( /^\d*[0-9](\.\d*[0-9])?$/.test( hoursStringdbValue.substring( 0, len - 1 ) ) === false ) {
            return false;
        }
        return calculateHoursValue( hoursStringdbValue, duration );
    }
    duration = hoursStringdbValue.slice( -2 ).toLowerCase();
    if( duration === 'mo' ) {
        if( /^\d*[0-9](\.\d*[0-9])?$/.test( hoursStringdbValue.substring( 0, len - 2 ) ) === false ) {
            return false;
        }
        return calculateHoursValue( hoursStringdbValue, duration );
    }
    return false;
};

/**
 * Check For Valid Hours Data
 *
 * @param {object} genericWidget - The qualified data of the viewModel
 * @param {string} unitOfTimeMeasure - Unit of Time Measure value
 * @returns {number} number
 */
var getHoursComplete = function( genericWidget, unitOfTimeMeasure ) {
    let hoursStringdbValue = genericWidget.dbValue.toString();
    let hoursStringValue = hoursStringdbValue.replace( / /g, '' );
    let workHours = 1;
    if( hoursStringValue !== '' ) {
        if( /^\d*[0-9](\.\d*[0-9])?$/.test( hoursStringValue ) ) {
            hoursStringdbValue += unitOfTimeMeasure;
        }
        workHours = getHoursValue( hoursStringdbValue );
    }
    return workHours;
};

/**
 * Check For Valid Hours Data
 *
 * @param {ctx} ctx - The qualified ctx of the viewModel
 * @param {object} data - The qualified data of the viewModel
 * @param {widget} genericWidget - Unit of Time Measure value
 * @returns {boolean} true/false
 */
var checkForHoursCriteria = function( ctx, data, genericWidget ) {
    let internalName = data.propertyContext.dbValue.split( '.' )[ 1 ];

    if( internalName === 'work_complete' || internalName === 'duration' || internalName === 'work_estimate' ) {
        if( genericWidget.dbValue ) {
            let workHours = getHoursComplete( genericWidget, 'h' );
            if( workHours ) {
                genericWidget.dbValue = workHours;
                return false;
            }
        }
        eventBus.publish( 'Saw1ProgramViewFilter.invalidHoursError' );
        return true;
    }
    return false;
};

/**
 * checkForValidations
 *
 * @param {var} i - The index
 * @param {ctx} ctx - The ctx of the viewModel
 * @param {data} data - The qualified data of the viewModel
 * @param {boolean} generateUid - Whether to generate UID or not
 * @returns {boolean} true/false
 */
var checkForValidations = function( i, ctx, data, generateUid, programViewFiltersConditions, atomicDataRef ) {
    let localisedTo = ' ' + data.i18n.to + ' ';
    let newProgramViewFiltersConditions = {};
    newProgramViewFiltersConditions.conditionName = i === 0 ? 'And' : data.conditionContext.dbValue;
    newProgramViewFiltersConditions.conditionDisplayName = i === 0 ? data.i18n.and : data.conditionContext.uiValue;
    newProgramViewFiltersConditions.typeName = data.typeContext.dbValue;
    newProgramViewFiltersConditions.typeDisplayName = data.typeContext.uiValue;
    newProgramViewFiltersConditions.propertyQName = data.propertyContext.dbValue;
    newProgramViewFiltersConditions.propertyDisplayName = data.propertyContext.uiValue;
    newProgramViewFiltersConditions.operatorName = data.operatorTypeContext.dbValue;
    newProgramViewFiltersConditions.operatorDisplayName = data.operatorTypeContext.uiValue;

    if( data.currentFieldValueType.dbValue === 'LISTBOX' ) {
        if( checkWidgetEmptyOrNot( data, data.genericValueContext ) ) {
            return false;
        }
        newProgramViewFiltersConditions.value = data.genericValueContext.uiValue.toString();
        newProgramViewFiltersConditions.internalValue = data.genericValueContext.dbValue.toString();

        if( data.currentConditionValueType.dbValue ) {
            if( checkWidgetEmptyOrNot( data, data.genericEndValueContext ) ) {
                return false;
            }
            newProgramViewFiltersConditions.value += localisedTo + data.genericEndValueContext.uiValue.toString();
            newProgramViewFiltersConditions.internalValue += ',' + data.genericEndValueContext.dbValue.toString();
        }
    } else {
        if( data.currentFieldValueType.dbValue === 'DATE' ) {
            if( checkWidgetEmptyOrNot( data, data.genericWidget ) ) {
                return false;
            }
            let date =  data.genericWidget.dbValue;
            let formatDate = dateTimeSvc.formatDate( date, data.genericWidget.dateApi.dateFormatPlaceholder );
            newProgramViewFiltersConditions.value = formatDate;
            newProgramViewFiltersConditions.internalValue = dateTimeSvc.formatUTC( date );
            if( data.currentConditionValueType.dbValue ) {
                if( checkWidgetEmptyOrNot( data, data.genericEndWidget ) ) {
                    return false;
                }
                if( data.genericEndWidget.dbValue >= 0 ) {
                    let endDate = data.genericEndWidget.dbValue;
                    let formatEndDate = dateTimeSvc.formatDate( endDate, data.genericEndWidget.dateApi.dateFormatPlaceholder );
                    newProgramViewFiltersConditions.value += localisedTo + formatEndDate;
                    newProgramViewFiltersConditions.internalValue += ',' + dateTimeSvc.formatUTC( endDate );
                }
            }
        } else if( data.currentFieldValueType.dbValue === 'PANEL' ) {
            data.filterResourceValue.dbValue === '' ? newProgramViewFiltersConditions.value = 'Unassigned' : newProgramViewFiltersConditions.value = data.filterResourceValue.dbValue;
            data.filterResourceValue.dbValue === '' ? newProgramViewFiltersConditions.internalValue = 'Unassigned' : newProgramViewFiltersConditions.internalValue = data.filterResourceValue.dbValue;
        } else {
            let internalName = data.propertyContext.dbValue.split( '.' )[ 1 ];
            if( internalName !== 'object_name' && internalName !== 'ResourceAssignment' && internalName !== 'object_desc' ) {
                if( checkWidgetEmptyOrNot( data, data.genericWidget ) ) {
                    return false;
                }
                if( checkForWorkCompletePercentCriteria( data, data.genericWidget ) || checkForHoursCriteria( ctx, data, data.genericWidget ) ) {
                    return false;
                }
                newProgramViewFiltersConditions.value = data.genericWidget.uiValue.toString();
                newProgramViewFiltersConditions.internalValue = data.genericWidget.dbValue.toString();
            } else {
                newProgramViewFiltersConditions.value = data.genericWidget.uiValue;
                newProgramViewFiltersConditions.internalValue = data.genericWidget.dbValue;
            }
            if( data.currentConditionValueType.dbValue ) {
                if( checkForWorkCompletePercentCriteria( data, data.genericEndWidget ) || checkForHoursCriteria( ctx, data, data.genericEndWidget ) ) {
                    return false;
                }
                if( checkWidgetEmptyOrNot( data, data.genericEndWidget ) ) {
                    return false;
                }
                newProgramViewFiltersConditions.value += localisedTo + data.genericEndWidget.uiValue.toString();
                newProgramViewFiltersConditions.internalValue += ',' + data.genericEndWidget.dbValue.toString();
            }
        }
    }
    if( generateUid ) {
        newProgramViewFiltersConditions.uid = Math.floor( Math.random() * 10000 + 1 ); // Uid generation for New Condition
    }
    let filterData = [];
    filterData[i] = newProgramViewFiltersConditions;

    if( programViewFiltersConditions.filtersData ) {
        // This is for adding new Filters
        let exisitngData = _.clone( programViewFiltersConditions.filtersData );
        exisitngData.push( newProgramViewFiltersConditions );
        programViewFiltersConditions.filtersData = exisitngData;
        programViewFiltersConditions.update( programViewFiltersConditions );
        return true;
    }
    // This is for editing exisitng Filters
    let exisitngUid = programViewFiltersConditions.uid;
    programViewFiltersConditions = newProgramViewFiltersConditions;
    programViewFiltersConditions.uid = exisitngUid;
    return {
        updatedValue : programViewFiltersConditions,
        isSuccess : true
    };
};

/**
 * Edit filter condition when clicked on the remove cell.
 *
 * @param {ctx} ctx - The ctx of the viewModel
 * @param {data} data - The qualified data of the viewModel
 * @returns {boolean} true/false
 */
var editFromProgramViewConditionsCtx = function( ctx, newProgramViewFiltersConditions, data, atomicDataRef, genericWidget, genericEndWidget, genericValueContextValues, filterResourceValue ) {
    let existingFilters = newProgramViewFiltersConditions.filtersData;
    for( let i = 0; i < existingFilters.length; i++ ) {
        let cond = existingFilters[ i ];
        if( cond.uid === _editCondition.uid ) {
            let validationResult = checkForValidations( i, ctx, data, '', existingFilters[ i ], atomicDataRef );
            if( !validationResult ) {
                return;
            }
            existingFilters[i] = validationResult.updatedValue;
            if( !validationResult.isSuccess ) {
                return false;
            }
            newProgramViewFiltersConditions.update( newProgramViewFiltersConditions );
            break;
        }
    }
    resetWidgets( genericWidget, genericEndWidget, genericValueContextValues, filterResourceValue );
    return true;
};

/**
 * Edit condition when clicked on the edit cell.
 *
 * @param {ctx} ctx - The condition available for edit
 * @param {data} data - The qualified data of the viewModel
 *
 */
export let editProgramViewFilterConditon = function( ctx, i18n, ProgramViewFiltersConditions, condition, type, property, operator ) {
    if( ctx.ProgramViewFilterConditonForEdit ) {
        let newCondn = _.clone( condition );
        let newType = _.clone( type );
        let newProp = _.clone( property );
        let newOp = _.clone( operator );
        newCondn.dbValue = ProgramViewFiltersConditions.filtersData.length === 1 ? 'And' : ctx.ProgramViewFilterConditonForEdit.cellHeaderInternalValue;
        newCondn.uiValue = ProgramViewFiltersConditions.filtersData.length === 1 ? i18n.and : ctx.ProgramViewFilterConditonForEdit.cellHeader1;
        newType.dbValue = ctx.ProgramViewFilterConditonForEdit.cellProperties.Type.internalValue;
        newType.uiValue = ctx.ProgramViewFilterConditonForEdit.cellProperties.Type.value;
        newProp.dbValue = ctx.ProgramViewFilterConditonForEdit.cellProperties.Property.internalValue;
        newProp.uiValue = ctx.ProgramViewFilterConditonForEdit.cellProperties.Property.value;
        newOp.dbValue = ctx.ProgramViewFilterConditonForEdit.cellProperties.Operator.internalValue;
        newOp.uiValue = ctx.ProgramViewFilterConditonForEdit.cellProperties.Operator.value;
        var typeInternalName = smConstants.PROGRAM_VIEW_VALID_OBJECT_LIST[ newType.dbValue ];
        typeInternalName = typeInternalName ? typeInternalName : newType.dbValue;
        return {
            cond: newCondn,
            type: newType,
            prop: newProp,
            opertr: newOp
        };
        // exports.getPropertyPreferences( typeInternalName, ctx, data, true );
    }
};

/**
 * Clean up the registers
 *
 * @param {ctx} ctx - The ctx of the viewModel
 */
export let cleanUpEdit = function( ctx ) {
    if( ctx.ProgramViewFilterConditonForEdit ) {
        appCtxService.unRegisterCtx( 'ProgramViewFilterConditonForEdit' );
        _editCondition = null;
    }
};

export let getPropertyPreferenceForFilters = function( ctx, data ) {
    if( ctx.programViewConfiguration ) {
        let programViewConfiguration = ctx.programViewConfiguration.configFromSOA;
        if( programViewConfiguration.filterSets ) {
            let filterSetLength = programViewConfiguration.filterSets.length;
            if( filterSetLength > 0 ) {
                if( programViewConfiguration.filterSets[ 0 ].filters.length > 0 ) {
                    exports.getPropertyPreferences( programViewConfiguration.filterSets[ 0 ].filters[ 0 ].attributeName.split( '.' )[ 0 ], ctx, data, false );
                    return;
                }
            }
        }
        exports.getPropertyPreferences( 'ScheduleTask', ctx, data, false );
    }
};

export let removeResource = function( filterResourceValue ) {
    let newResource = _.clone( filterResourceValue );
    newResource.dbValue = '';
    newResource.uiValue = '';
    newResource.dispValue = '';
    return newResource;
};

export let saveResourceSelectionValues = function( ctx, data ) {
    if( ctx.ProgramViewFilterConditonForEdit ) {
        ctx.ProgramViewFilterConditonForEdit.cellHeaderInternalValue = data.conditionContext.dbValue;
        ctx.ProgramViewFilterConditonForEdit.cellHeader1 = data.conditionContext.uiValue;
        ctx.ProgramViewFilterConditonForEdit.cellProperties[ data.typeSection.dbValue ].internalValue = data.typeContext.dbValue;
        ctx.ProgramViewFilterConditonForEdit.cellProperties[ data.typeSection.dbValue ].value = data.typeContext.uiValue;
        ctx.ProgramViewFilterConditonForEdit.cellProperties[ data.propertySection.dbValue ].internalValue = data.propertyContext.dbValue;
        ctx.ProgramViewFilterConditonForEdit.cellProperties[ data.propertySection.dbValue ].value = data.propertyContext.uiValue;
        ctx.ProgramViewFilterConditonForEdit.cellProperties[ data.operatorSection.dbValue ].internalValue = data.operatorTypeContext.dbValue;
        ctx.ProgramViewFilterConditonForEdit.cellProperties[ data.operatorSection.dbValue ].value = data.operatorTypeContext.uiValue;
        resetWidgets( data );
    }
};

/**
 * Method to add user to filterResourceValue.
 *
 * @param selectedUser - Selected user/resourcepool/discipline to be added
 * @param data - data of the viewModel
 *
 */
export let addSelectedUsers = function( selectedUser, filterResVal ) {
    const [ userToAdd ] = selectedUser;
    let newFilterResourceValue = _.clone( filterResVal );

    if ( userToAdd ) {
        let internalValue;
        if ( userToAdd.type === 'ResourcePool'  ) {
            internalValue = userToAdd.props.object_string.uiValues[0];
        } else if ( userToAdd.type === 'User' || userToAdd.type === 'Discipline' ) {
            internalValue = userToAdd.props.object_string.uiValues[0].split( ' (' )[1].split( ')' )[0];
        }
        newFilterResourceValue.dbValue = internalValue;
        newFilterResourceValue.uiValue = internalValue;
        newFilterResourceValue.dispValue = internalValue;

        return newFilterResourceValue;
    }
};

export const validateIfTypePropIsPresent = () => {
    return Boolean( appCtxService.getCtx( 'ProgramViewPreferenceMap' ) );
};

export const selectionChangeOfOperatorContext = ( propertyContext, genericWidget, operatorTypeContext, currentConditionValueType, genericEndWidget, genericValueContext, i18n ) => {
    const newWidget = _.clone( genericWidget );
    const newOperatorTypeContext = _.clone( operatorTypeContext );
    const newCurrentConditionValueType = _.clone( currentConditionValueType );
    const newGenericEndWidget = _.clone( genericEndWidget );
    const newGenericValueContext = _.clone( genericValueContext );

    selectionChangeOfOperator( propertyContext, newWidget, newOperatorTypeContext, newCurrentConditionValueType, newGenericEndWidget, newGenericValueContext, i18n );
    return {
        widget: newWidget,
        operatorValues: newOperatorTypeContext,
        conditionValueType: newCurrentConditionValueType,
        genWidget: newGenericEndWidget,
        genValueContext: newGenericValueContext

    };
};

/**
 * Add the Program view filter condition to ctx
 *
 * @param {ctx} ctx - The ctx of the viewModel
 * @param {data} data - The qualified data of the viewModel
 * @returns {Object} test
 */
export let addProgramViewConditionToCtx = function( ctx, programViewFiltersConditions, data, atomicDataRef, genericWidget, genericEndWidget, genericValueContextValues, filterResourceValue ) {
    let newGenericWidget = _.clone( genericWidget );
    let newGenericEndWidget = _.clone( genericEndWidget );
    let newGenericValueContextValues = _.clone( genericValueContextValues );
    let newfilterResourceValue = _.clone( filterResourceValue );
    let newProgramViewFiltersConditions = programViewFiltersConditions;
    if( !newProgramViewFiltersConditions ) {
        newProgramViewFiltersConditions.update( [] );
    }
    let deferred = AwPromiseService.instance.defer();
    if( ctx.ProgramViewFilterConditonForEdit /*&& _addResource === null*/ ) {
        _editCondition = ctx.ProgramViewFilterConditonForEdit;
        if( !editFromProgramViewConditionsCtx( ctx, newProgramViewFiltersConditions, data, atomicDataRef, newGenericWidget, newGenericEndWidget, newGenericValueContextValues, newfilterResourceValue ) ) {
            return deferred.promise;
        }
        ctx.ProgramViewFilterConditonForEdit = [];
        _editCondition = null;
    } else {
        let length = newProgramViewFiltersConditions.filtersData.length;

        if( !checkForValidations( length, ctx, data, true, newProgramViewFiltersConditions, atomicDataRef ) ) {
            return deferred.promise;
        }
    }
    // _addResource = null;
    _resetEditWidgets = false;
    exports.cleanUpEdit( ctx );
    return {
        widget: newGenericWidget,
        endWidget: newGenericEndWidget,
        contextVals: newGenericValueContextValues,
        filterResource: newfilterResourceValue
    };
};

export default exports = {
    selectionChangeOfOperatorContext,
    populateTypeNames,
    selectionChangeOfTypeContext,
    propUpdated,
    displayPropertyPreferencesAction,
    getPropertyPreferences,
    editProgramViewFilterConditon,
    cleanUpEdit,
    getPropertyPreferenceForFilters,
    removeResource,
    saveResourceSelectionValues,
    addSelectedUsers,
    validateIfTypePropIsPresent,
    updateTypePropMap,
    processPropDesc,
    addProgramViewConditionToCtx,
    getPriorities,
    getState,
    getStatus,
    updateExistingStates
};
