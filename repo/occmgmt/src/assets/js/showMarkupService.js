// Copyright (c) 2022 Siemens

/**
 * @module js/showMarkupService
 */
import uwPropertySvc from 'js/uwPropertyService';
import cdmSvc from 'soa/kernel/clientDataModel';
import appCtxSvc from 'js/appCtxService';
import soa_kernel_clientDataModel from 'soa/kernel/clientDataModel';
import viewModelObjectService from 'js/viewModelObjectService';
import eventBus from 'js/eventBus';
import occmgmtUtils from 'js/occmgmtUtils';
import occMgmtStateHandler from 'js/occurrenceManagementStateHandler';
import _ from 'lodash';
import AwStateService from 'js/awStateService';
import occmgmtTTDataService from 'js/aceTreeTableDataService';
import acePropertyPolicyService from 'js/acePropertyPolicyService';
import propertyPolicySvc from 'soa/kernel/propertyPolicyService';
import tableSvc from 'js/splmTablePublishedService';

var exports = {};
let policyId;
var policy = {
    types: [ {
        name: 'Awb0ConditionalElement',
        properties: [
            {
                name: 'awb0MarkupPropertyNames',
                modifiers: [ {
                    name: 'excludeUiValues',
                    Value: 'true'
                } ]
            },
            {
                name: 'awb0MarkupPropertyValues'
            },
            {
                name: 'awb0MarkupType',
                modifiers: [ {
                    name: 'excludeUiValues',
                    Value: 'true'
                } ]
            }
        ]
    } ]
};
var _editEventSubDef = null;

const NO_OLD_VALUES_FOUND_INDICATOR = 'NO_OLD_VALUE_FOUND';

export var rowMarkupRenderer = {
    action: function( column, vmo, tableElem ) {
        var cellContent = tableSvc.createElement( column, vmo, tableElem );
        // No green line for tracked property changes in context of absolute occurrence
        var isPropChgAddCol = false;
        if( vmo.propChangeWithAdd === true ) {
            var absProps = vmo.props.awb0MarkupPropertyNames ? vmo.props.awb0MarkupPropertyNames.dbValues : undefined;
            if( absProps !== undefined && absProps.length > 0 && absProps.indexOf( column.field ) >= 0 ) {
                isPropChgAddCol = true;
            }
        }
        if( vmo.isAdded ) {
            if( isPropChgAddCol === false ) {
                cellContent.classList.add( 'aw-grid-markup-added' );
            }
        } else {
            //Control will come here if other condition met. No need to evaluate condition twice.
            cellContent.classList.add( 'aw-grid-markup-deleted' );
        }

        return cellContent;
    },
    condition: function( column, vmo ) {
        return vmo.isAdded || vmo.isDeleted && column.name !== 'Awb0ConditionalElement.awb0PendingAction';
    },
    name: 'rowMarkupRenderer'
};

var updateModifiedObjects = function() {
    var eventData = {
        relatedModified: appCtxSvc.ctx.mselected,
        refreshLocationFlag: true
    };
    eventBus.publish( 'cdm.relatedModified', eventData );
};

/**
 * Register editHandlerStateChange event callback fuction when markup is toggled ON else de-register.
 * OFF.
 * @param {boolean} isRegister - true to register editHandlerStateChange event callback function else false to de-register.
 */
var registerEventsInMarkupMode = function( isRegister, contextKey ) {
    if( isRegister ) {
        if( !_editEventSubDef ) {
            _editEventSubDef = eventBus.subscribe( 'editHandlerStateChange', editEventHandlerCallbackFunction );
        }
        appCtxSvc.updatePartialCtx( contextKey + '.retainTreeExpansionStateInJitterFreeWay', true );
    } else if( _editEventSubDef ) {
        eventBus.unsubscribe( _editEventSubDef );
        _editEventSubDef = null;
    }
};

/**
 * Updating occmgmt context isMarkupEnabled
 *
 * @param {string} markupToggleState mark-up toggle state. true if mark-up is enabled else false.
 */
/* TODO :
subPanelContext is not passed by all callers. Once framework starts passing it for decorators,
need to update isMarkupEnabled on occContext instead of occmgmtContext.
*/
export let updateCtxWithShowMarkupValue = function( markupToggleState ) {
    var isTrue = markupToggleState === 'true';
    let isRedLineMode = appCtxSvc.getCtx( 'isRedLineMode' );
    if( isTrue || isRedLineMode === 'true' ) {
        policyId = propertyPolicySvc.register( policy );
    } else if ( isTrue === false || isRedLineMode === 'false' ) {
        propertyPolicySvc.unregister( policyId );
    }
    let contextKey = appCtxSvc.ctx.aceActiveContext.key;
    appCtxSvc.updatePartialCtx( contextKey + '.isMarkupEnabled', isTrue );
    registerEventsInMarkupMode( isTrue, contextKey );
};

/**
 * To check if mark-up is enabled or not.
 *
 * @return {boolean} - true if mark-up is enabled else return false.
 */
let isMarkupModeEnabled = function() {
    let isBOMMarkupEnabled = false;
    if( appCtxSvc.ctx.aceActiveContext ) {
        let context = appCtxSvc.getCtx( appCtxSvc.ctx.aceActiveContext.key );
        if( context && !_.get( appCtxSvc.ctx.splitView, 'mode' ) ) {
            isBOMMarkupEnabled = context.isMarkupEnabled;

            if( context.supportedFeatures && !context.supportedFeatures.Awb0MarkupFeature ) {
                exports.updateCtxWithShowMarkupValue( 'false' );
                return false;
            } else if( context.isMarkupEnabled === undefined ) {
                let productContextInfo = context.productContextInfo;
                if( !productContextInfo && context.currentState ) {
                    productContextInfo = soa_kernel_clientDataModel.getObject( context.currentState.pci_uid );
                }

                if( productContextInfo && productContextInfo.props.awb0WindowStateToggles &&
                    productContextInfo.props.awb0WindowStateToggles.dbValues ) {
                    isBOMMarkupEnabled = occMgmtStateHandler.getShowMarkupState( productContextInfo.props.awb0WindowStateToggles.dbValues[ 0 ] );
                    exports.updateCtxWithShowMarkupValue( isBOMMarkupEnabled.toString() );
                    return isBOMMarkupEnabled;
                }
            }
        } else if( _.get( appCtxSvc.ctx.splitView, 'mode' ) ) {
            exports.updateCtxWithShowMarkupValue( 'false' );
        }
    }
    return isBOMMarkupEnabled;
};

/**
 * To check if change mode is enabled or not.
 * @param { String } vmo - View Model Object
 * @return {boolean} - true if change is enabled else return false.
 *
 * */
let isChangeEnabled = function( vmo ) {
    if( appCtxSvc.ctx.aceActiveContext ) {
        var currentContext = appCtxSvc.getCtx( appCtxSvc.ctx.aceActiveContext.key );
        let pci = occmgmtUtils.getProductContextInfoForProvidedObject( vmo, currentContext );
        let pciObject = cdmSvc.getObject( pci );
        if( pciObject && pciObject.props.awb0WindowStateToggles && pciObject.props.awb0WindowStateToggles.dbValues.length > 0 ) {
            let windowToggles = pciObject.props.awb0WindowStateToggles.dbValues[ 0 ];
            return occMgmtStateHandler.getShowChangeState( windowToggles );
        }
    }
};

/**
 * Handle LOV property on edit action.
 * @param {Object} vmoProps - contains list of ViewModelProperty
 * @param {boolean} isEditStarting - true if edit state is starting else false.
 */
var handleLOVPropertyOldValueOnEditAction = function( vmoProps, isEditStarting ) {
    if( vmoProps && vmoProps.awb0MarkupPropertyNames && vmoProps.awb0MarkupPropertyNames.dbValues ) {
        for( var idx = 0; idx < vmoProps.awb0MarkupPropertyNames.dbValues.length; idx++ ) {
            var propertyName = vmoProps.awb0MarkupPropertyNames.dbValues[ idx ];

            if( vmoProps[ propertyName ] && vmoProps[ propertyName ].hasLov ) {
                if( isEditStarting ) {
                    // when user start edit then set oldValue to uiValue to present it to user to modify.
                    vmoProps[ propertyName ].uiValue = vmoProps[ propertyName ].oldValue;
                } else {
                    // when user cancel edit then reset uiValue to displayValue .
                    vmoProps[ propertyName ].uiValue = vmoProps[ propertyName ].displayValues[ 0 ];
                }
            }
        }
    }
};

/**
 * Listen to event edithandlerStateChange event to handle any additional processing required for markup.
 * @param {Object} context - Context object which contains stateName and dataSource
 */
var editEventHandlerCallbackFunction = function( context ) {
    // Three states of editing are as - starting, saved, canceling
    if( isMarkupModeEnabled() ) {
        if( context.state === 'starting' || context.state === 'canceling' ) {
            var isEditStarting = context.state === 'starting';
            if( context.dataSource.awb0MarkupPropertyNames && context.dataSource.awb0MarkupPropertyNames.dbValues ) {
                handleLOVPropertyOldValueOnEditAction( context.dataSource, isEditStarting );
            } else if( context.dataSource.viewModelCollection ) {
                if( context.dataSource.viewModelCollection.getLoadedViewModelObjects() ) {
                    for( var vmoIndx = 0; vmoIndx < context.dataSource.viewModelCollection.getLoadedViewModelObjects().length; vmoIndx++ ) {
                        var vmo = context.dataSource.viewModelCollection.getViewModelObject( vmoIndx );
                        handleLOVPropertyOldValueOnEditAction( vmo.props, isEditStarting );
                    }
                }
            }
        } else if( context.state === 'saved' ) {
            let stateParams = AwStateService.instance.params;
            if( stateParams && stateParams.spageId === 'tc_xrt_Markup' ) {
                updateModifiedObjects();
            }
        }
    }
};

var isJson = function( str ) {
    try {
        return JSON.parse( str );
    } catch ( e ) {
        return false;
    }
};

/**
 * This API is setting new ui value and old ui value on property object vmo.
 * @param {ViewModelObject} propertyObject property object whose display need to be updated
 * @param {*} oldUIValue old UI value
 * @param {*} newUIValue new UI Value
 * @param {*} oldDBValue old DB value
 */
var updateDisplayValues = function( propertyObject, oldUIValue, newUIValue, oldDBValue, isChange ) {
    let deltaValues = isJson( oldUIValue );
    if( isChange && !( deltaValues === false ) && typeof deltaValues === 'object' ) {
        propertyObject.deltaValues = deltaValues;
    } else {
        uwPropertySvc.setOldValues( propertyObject, [ oldUIValue ] );
        propertyObject.uiValues = [ newUIValue ];
        propertyObject.uiValue = newUIValue;
        propertyObject.displayValues = [ newUIValue ];
        // If user clicks on value (new value) then it should open new object of LOV
        if( propertyObject.hasLov ) {
            propertyObject.dbValue = oldDBValue;
        }
    }
};

/**
 * This API checks whether incoming vmo is an newly added VMO in mark up mode or not.
 * If it is newly added VMO thenit returns true otherwise it return false.
 * @param {ViewModelObject} vmo
 */
let isVMOIsNewlyAddedMarkUpElement = function( vmo ) {
    if( vmo.type === 'Awb0MarkupElement' ||
        vmo.props.awb0MarkupType && ( vmo.props.awb0MarkupType.dbValue & 128 ) === 128 ) {
        return true;
    }
    return false;
};

/**
 * We are just checking whether oldValues is available or not. If it is available then
 * old value will come from this array
 * @param {Property object} propertyObject
 */
var searchForOldValuesInVMO = function( propertyObject ) {
    if( propertyObject.oldValues ) {
        return uwPropertySvc.getUiValue( propertyObject.oldValues );
    }
    return NO_OLD_VALUES_FOUND_INDICATOR;
};

/**
 * This API will get the appropriate old value for each vmo.
 * @param {ViewModelObject} propertyObject
 * @param {MarkUpPropertyValue} markupPropUIValue
 */
let getOldValueFromVMO = function( propertyObject, markupPropUIValue ) {
    let oldValue = searchForOldValuesInVMO( propertyObject );
    if( _.isEqual( oldValue, NO_OLD_VALUES_FOUND_INDICATOR ) ) {
        if( propertyObject.valueUpdated && propertyObject.hasLov ) {
            oldValue = uwPropertySvc.getUiValue( propertyObject.prevDisplayValues );
        } else {
            oldValue = uwPropertySvc.getUiValue( propertyObject.prevDisplayValues );
            // case when we use a substitute in mark up mode. prevDisplay values are
            // getting updated by uiValues in framework. In such cases, we are taking old value from
            // value attribute.
            if( oldValue === markupPropUIValue ) {
                oldValue = propertyObject.value;
            }
        }
    }
    oldValue = postProcessOldValueIfItEmptyString( oldValue );
    return oldValue;
};

/**
 * This API reads markupProperty names and values array and update those property
 * VMOs with old value and new value.
 * @param {*} vmo
 * @param {String array} markupPropNames
 * @param {String array} markupDisplayValues
 * @param {String array} markupDBValues
 */
let updateOldValueNewValueForMarkUpProperty = function( vmo, markupPropNames, markupDisplayValues, markupDBValues ) {
    for( let index = 0; index < markupPropNames.length; ++index ) {
        let markupPropName = markupPropNames[ index ];
        let markupPropUIValue = markupDisplayValues[ index ];
        let propertyObject = vmo.props[ markupPropName ];
        if( propertyObject ) {
            if( isMarkupModeEnabled() ) {
                let oldValue = propertyObject.oldValue;
                if( !oldValue ) {
                    oldValue = getOldValueFromVMO( propertyObject, markupPropUIValue );
                }
                updateDisplayValues( propertyObject, oldValue, markupPropUIValue, markupDBValues[ index ] );
            } else if( isChangeEnabled( vmo ) ) {
                updateDisplayValues( propertyObject, postProcessOldValueIfItEmptyString( markupPropUIValue ), propertyObject.uiValue, propertyObject.dbValue, true );
            }
        }
    }
};

let resetMarkUpProperties = function( vmo ) {
    let propList = vmo.props;
    const keys = Object.keys( propList );
    for( const key of keys ) {
        let propertyObject = vmo.props[ key ];
        if( !_.isUndefined( propertyObject ) ) {
            let oldValue = propertyObject.oldValue;
            if( oldValue ) {
                delete propertyObject.oldValue;
            }
            let deltaValues = propertyObject.deltaValues;
            if( deltaValues ) {
                delete propertyObject.deltaValues;
            }
        }
    }
};

/**
 *
 * @param {ViewModelObject} vmo
 */
let processMarkUpProperties = function( vmo ) {
    let markupPropNamesObj = vmo.props.awb0MarkupPropertyNames;
    let markupPropValuesObj = vmo.props.awb0MarkupPropertyValues;
    if( markupPropNamesObj && markupPropNamesObj.dbValues &&
        markupPropNamesObj.dbValues.length > 0 &&
        markupPropValuesObj && markupPropValuesObj.dbValues &&
        markupPropValuesObj.dbValues.length > 0 ) {
        updateOldValueNewValueForMarkUpProperty( vmo, markupPropNamesObj.dbValues,
            markupPropValuesObj.displayValues, markupPropValuesObj.dbValues );
    }
};
/**
 * Populate VMO with mark-up values(old values).
 * @param {ViewModelObject} vmo - View model object to evaluate for decorator.
 */
export let populateMarkupValues = function( vmo ) {
    if( vmo && vmo.props ) {
        if( isMarkupModeEnabled() || isChangeEnabled( vmo ) ) {
            // If awb0MarkupType = 128  consider the element as a newly added markup element.
            // For AW4.2 and TC12.2 newly added markup element is also returned as Awb0DesignElement
            vmo.isAdded = isVMOIsNewlyAddedMarkUpElement( vmo );
            // if yes then stop further processing.
            vmo.isDeleted = false;
            vmo.propChangeWithAdd = Boolean( vmo.props.awb0MarkupType && vmo.props.awb0MarkupType.dbValue === 144 );
            // moved line with tracked absolute occurrence property changes will be processed.
            if( vmo.isAdded && !vmo.propChangeWithAdd ) {
                resetMarkUpProperties( vmo );
                return;
            }

            if( vmo.props.awb0MarkupType ) {
                vmo.isDeleted = ( vmo.props.awb0MarkupType.dbValue & 2 ) === 2; /* eslint-disable-line no-bitwise */
                if( !vmo.isDeleted ) {
                    resetMarkUpProperties( vmo );
                    processMarkUpProperties( vmo );
                }
            }
        }
    }
};

/**
 * Load markup object.
 * @param {Object} response - Server response object
 */
export let loadMarkupObject = function( response ) {
    var results = JSON.parse( response.searchResultsJSON );
    if( results.objects && results.objects.length > 0 ) {
        var markupuid = results.objects[ 0 ].uid;
        var activemarkup = soa_kernel_clientDataModel.getObject( markupuid );
        if( !viewModelObjectService.isViewModelObject( activemarkup ) ) {
            activemarkup = viewModelObjectService.constructViewModelObjectFromModelObject( activemarkup, 'EDIT' );
        }
        appCtxSvc.updatePartialCtx( 'activemarkup', activemarkup );
    } else {
        appCtxSvc.updatePartialCtx( 'activemarkup', undefined );
    }
};

/**
 * Get primary selected object uid to fetch markup summary data.
 * @returns {String} - uid of primary selected object
 */
export let getSelectedUIDToLoadMarkupSummaryData = function() {
    var mSelectedObj = appCtxSvc.getCtx( 'mselected' )[ 0 ];
    if( mSelectedObj.type === 'Fnd0MarkupChange' ) {
        mSelectedObj = appCtxSvc.getCtx( 'pselected' );
    }
    return mSelectedObj ? mSelectedObj.uid : '';
};

/**
 * populates source Uid and target Uid on newly added BOMLine
 * @param {ViewModelObject} selectedVMO
 * @param {SOA response} response
 * @param {*} data
 */
let populateSourceAndTargetUidOfNewLinesInData = function( selectedVMO, response, srcUids, targetUids ) {
    let addedMarkupObjects = selectedVMO.children.filter( function( vmo ) {
        return vmo.isAdded || vmo.props && vmo.props.awb0MarkupType && vmo.props.awb0MarkupType.dbValue === 256;
    } );
    let innerIdx = 0; // Initialize loop counter
    for( let index = 0, noOfCreatedObjects = response.created.length; index < noOfCreatedObjects; ++index ) {
        let targetMO = soa_kernel_clientDataModel.getObject( response.created[ index ] );
        if( targetMO && targetMO.props && targetMO.props.awb0Parent && targetMO.props.awb0Parent.dbValues &&
            targetMO.props.awb0Parent.dbValues[ 0 ] === selectedVMO.uid ) {
            for( let noOfAddedMarkups = addedMarkupObjects.length; innerIdx < noOfAddedMarkups; ) {
                targetUids.push( response.created[ index ] );
                srcUids.push( addedMarkupObjects[ innerIdx ].uid );
                ++innerIdx;
                break;
            }
        }
    }
};

/**
 * This API populates data variable with source object's Uid and target object's Uid.
 * @param {Data} data
 * @param {*} selectedVMO
 */
let populatesSourceAndTargetUidOfReplacedLinesInData = function( data, selectedVMO, srcUids, targetUids  ) {
    if( data.replacedObjects ) {
        for( let index = 0, noOfReplacedObjects = data.replacedObjects.length; index < noOfReplacedObjects; ++index ) {
            for( let innerIdx = 0, noOfChildObjects = selectedVMO.children.length; innerIdx < noOfChildObjects; ++innerIdx ) {
                if( selectedVMO.children[ innerIdx ].uid === data.replacedObjects[ index ] ) {
                    srcUids.push( selectedVMO.children[ innerIdx ].uid );
                    targetUids.push( selectedVMO.children[ innerIdx ].uid );
                }
            }
        }
    }
};

/**
 * This API deletes the properties of vmo to get updated properties from the server.
 * @param {SOA response} response
 * @param {Selected ViewModelObject} selectedVMO
 * @param {*} data
 */
let deletePropFieldToGetUpdatedPropsFromServer = function( response, selectedVMO, srcUids ) {
    for( let index = 0, noOfUpdatedObjects = response.updated.length; index < noOfUpdatedObjects; ++index ) {
        for( let innerIdx = 0, noOfChildObjects = selectedVMO.children.length; innerIdx < noOfChildObjects; ++innerIdx ) {
            if( selectedVMO.children[ innerIdx ].uid === response.updated[ index ] && !srcUids.includes( selectedVMO.children[ innerIdx ].uid ) ) {
                delete selectedVMO.children[ innerIdx ].props;
            }
        }
    }
};

/**
 * Sets source and target elements
 * @param {*} response SOA response
 * @param {*} data data
 */
export let setSourceAndTargetElements = function( response, data ) {
    let srcUids = [];
    let targetUids = [];
    if( appCtxSvc.ctx.aceActiveContext.context.vmc ) {
        let vmc = appCtxSvc.ctx.aceActiveContext.context.vmc;
        let selectedVMOIdx = _.findLastIndex( vmc.getLoadedViewModelObjects(), function( vmo ) {
            return vmo.uid === appCtxSvc.ctx.occmgmtContext.pwaSelection[0].uid;
        } );

        let selectedVMO = vmc.getViewModelObject( selectedVMOIdx );
        if( selectedVMO && selectedVMO.children ) {
            //Populate Source and Target uids for newly created bomline of
            //corresponding added Markup lines
            if( response.created ) {
                populateSourceAndTargetUidOfNewLinesInData( selectedVMO, response, srcUids, targetUids );
            }
            //Populate Source and Target uids for replaced bomlines if any
            populatesSourceAndTargetUidOfReplacedLinesInData( data, selectedVMO, srcUids, targetUids );
            // Deleting the props field for updated property which will trigger SOA to update the properties.
            if( response.updated ) {
                deletePropFieldToGetUpdatedPropsFromServer( response, selectedVMO, srcUids );
            }
        }
    }
    return { srcUids: srcUids, targetUids:targetUids };
};

/**
 * Preprocess the input data before applyMarkup SOA gets called.
 * @param {*} data
 */
export let applyMarkupPreProcessing = function() {
    let replacedObjects = [];
    if( appCtxSvc.ctx.aceActiveContext.context.vmc ) {
        var vmc = appCtxSvc.ctx.aceActiveContext.context.vmc;
        var selectedVMOIdx = _.findLastIndex( vmc.getLoadedViewModelObjects(), function( vmo ) {
            return vmo.uid === appCtxSvc.ctx.selected.uid;
        } );

        var selectedVMO = vmc.getViewModelObject( selectedVMOIdx );
        if( selectedVMO && selectedVMO.children ) {
            selectedVMO.children.filter( function( vmo ) {
                if( vmo.props && vmo.props.awb0MarkupType && vmo.props.awb0MarkupType.dbValue === 8 ) {
                    replacedObjects.push( vmo.uid );
                }
            } );
        }
    }
    return replacedObjects;
};

/**
 * Returns "-" if property's old value is empty or array of empty array.
 * @param {VMO property value} oldValue : Old value of property
 */
let postProcessOldValueIfItEmptyString = function( oldValue ) {
    if( !oldValue || oldValue.length === 0 ) {
        return '-';
    } else if( Array.isArray( oldValue ) && oldValue.length && oldValue.length === 1 &&
        _.isEqual( oldValue[ 0 ], '' ) ) {
        return '-';
    }
    return oldValue;
};

let _markupProps = [
    {
        name: 'awb0MarkupPropertyNames',
        modifiers: [ {
            name: 'excludeUiValues',
            Value: 'true'
        } ]
    },
    {
        name: 'awb0MarkupPropertyValues'
    },
    {
        name: 'awb0MarkupType',
        modifiers: [ {
            name: 'excludeUiValues',
            Value: 'true'
        } ]
    }
];

const markupPropertyHandler = {
    key: 'markupProperty',
    callbackFunction: ( overriddenPropertyPolicy ) => {
        let isRedLineMode = appCtxSvc.getCtx( 'isRedLineMode' );
        if( isRedLineMode === 'true' ) {
            overriddenPropertyPolicy = acePropertyPolicyService.removeFromOverriddenPropertyPolicy( overriddenPropertyPolicy, 'Awb0ConditionalElement', new Set( _markupProps.map( field => field.name ) ) );
        } else {
            occmgmtTTDataService.updateOverriddenPropertyPolicy( overriddenPropertyPolicy, 'Awb0ConditionalElement', _markupProps );
        }
    },
    condition: ( occContext ) => {
        let isEnabled = false;
        if( !_.isUndefined( occContext.productContextInfo ) && !_.isUndefined( occContext.productContextInfo.props ) &&  !_.isUndefined( occContext.productContextInfo.props.awb0WindowStateToggles )  ) {
            let isShowChangeEnabled = occMgmtStateHandler.getShowChangeState( occContext.productContextInfo.props.awb0WindowStateToggles.dbValues[0] );
            let isMarkupEnabled = occMgmtStateHandler.getShowMarkupState( occContext.productContextInfo.props.awb0WindowStateToggles.dbValues[0] );
            if( isShowChangeEnabled || isMarkupEnabled ) {
                isEnabled = true;
            }
        }
        if( occContext.isDuplicateEnabled ) {
            isEnabled = true;
        }

        return isEnabled;
    }
};

/**
 * Register the call back function for each and every property which needs to add as a part of overridden property policy.
 */
export let registerHandlerForOverriddenProperties = function( ) {
    occmgmtTTDataService.registerOverriddenPropertyPolicyHandler( markupPropertyHandler );
};


/**
 * Show BOM Mark-up Configuration service utility
 * @param {uwPropertyService} uwPropertySvc - Service to use.
 * @param {appCtxService} appCtxSvc - Service to use
 * @param {clientDataModel} soa_kernel_clientDataModel - Service to use
 * @param {viewModelObjectService} viewModelObjectService - Service to use
 * @returns {object} - object
 */

export default exports = {
    rowMarkupRenderer,
    updateCtxWithShowMarkupValue,
    populateMarkupValues,
    loadMarkupObject,
    getSelectedUIDToLoadMarkupSummaryData,
    setSourceAndTargetElements,
    applyMarkupPreProcessing,
    registerHandlerForOverriddenProperties
};
