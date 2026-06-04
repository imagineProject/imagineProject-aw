// Copyright (c) 2022 Siemens

/**
 * @module js/CadBomOccurrenceAlignmentUtil
 */
import { getBaseUrlPath } from 'app';
import cdmSvc from 'soa/kernel/clientDataModel';
import AwPromiseService from 'js/awPromiseService';
import appCtxSvc from 'js/appCtxService';
import AwStateService from 'js/awStateService';
import localeService from 'js/localeService';
import _ from 'lodash';
import CadBomAlignmentUtil from 'js/CadBomAlignmentUtil';
import cbaConstants from 'js/cbaConstants';
import cbaObjectTypeService from 'js/cbaObjectTypeService';
import dataManagementService from 'soa/dataManagementService';
import occmgmtUtil from 'js/occmgmtUtils';
import messagingService from 'js/messagingService';
import eventBus from 'js/eventBus';
import viewModelObjectSvc from 'js/viewModelObjectService';
import acePartialSelectionService from 'js/acePartialSelectionService';

let exports = {};

/**
 * Update state from URL parameters
 *
 * @param {Object} paramsToBeStoredOnUrl The object containing URL parametrers
 */
export let addParametersOnUrl = function( paramsToBeStoredOnUrl ) {
    let params = { ...AwStateService.instance.params };

    _.forEach( paramsToBeStoredOnUrl, function( value, name ) {
        params[ name ] = value;
    } );
    AwStateService.instance.go( AwStateService.instance.current.name, params );
};

/**
 * Check if top element is selected in context
 * @param {object} occContext - occContext object
 * @returns {boolean} True if top element is selected else false
 */
export let isTopElementSelected = function( occContext ) {
    return occContext?.pwaSelection?.some( selectedModelObject => {
        return occContext.topElement.uid === selectedModelObject.uid;
    } );
};

/**
 * Check if row has been selected as default in context
 * Note : This use case will come in picture if user selects row and perform refresh
 * @param {object} occContext - occContext object
 * @returns {boolean} True if default row selected in context else False
 */
let _isSingleRowSelectedAfterRefresh = function( occContext ) {
    return !occContext?.isRowSelected && !isTopElementSelected( occContext );
};

/**
 * Checks if either Source or Target row has been selected from UI
 * @param {object} subPanelContext - subPanelContext that need to be updated
 * @param {String} eventData - selectionChangeEvent eventData
 */
export let updateCBAContextOnRowSelection = function( subPanelContext, eventData ) {
    let target = subPanelContext?.provider?.occContext;
    let selectedObjectsLength = eventData?.selectedObjects?.length;

    // Fix the issue: LCS-937300 - Align/Remove alignment button not getting enabled for some parts
    /*
     eventData.selectedUids - first time included previous selected Objects uids, second time included currently selected Objects uids (and also include packed lines uids)
     eventData.selectedObjects - included current selected Objects in UI
     target.selectedModelObjects - included previous selected Objects (include packed lines, but not include collapsed lines)
    */
    if( selectedObjectsLength === 0 ) {
        subPanelContext?.selectionModel.setSelection( [] );
    }else if( selectedObjectsLength < target?.pwaSelection.length ) {
        /*
         Filter out the deselect objects
         If deselected object is packed, can filter out all master and packed lines of deselected object
         If deselected object is not packed, can filter the deselected object
        */
        let deselectObjs = target?.pwaSelection.filter( preSelectedObject => eventData.selectedObjects.every( curSelectedObject => curSelectedObject.uid !== preSelectedObject.uid ) );

        if( deselectObjs.length === 1 ) {
            /*
             Figure out if still have other selected objects in collpased nodes or not.
             Use case: have bellow structure, D1 and D2 aligned to P1-
             DTop                          PTop
                |_SA1 (Collpased)             |_P1 (Aligned to D1 and D2)
                    |_D1                      |_P2 (Aligned to D3)
                |_SA2 (Expanded)
                    |_D2
                |_SA3
                    |_D3
             If perform Find Aligned from P1, will selected D1 and D2, and D1 was collpased. Meanwhile, select SA3
             If deselect D2, shoulod also deselect D1, in DBOM, should only keep SA3 is selected
            */
            let findAlignedInfo = appCtxSvc.getCtx( cbaConstants.CTX_PATH_FIND_ALIGNED_INFO );
            if( findAlignedInfo ) {
                let contextFindAlignedInfo = findAlignedInfo[ target?.viewKey ];
                if( contextFindAlignedInfo[ deselectObjs[0].uid] ) {
                    // if deselect the object from Find Aligned result (D2)
                    for( let cachedUid in contextFindAlignedInfo ) {
                        if( cachedUid !== deselectObjs[0].uid && eventData.selectedObjects.every( curSelectedObject => curSelectedObject.uid !== cachedUid ) ) {
                            let cachedObj = cdmSvc.getObject( cachedUid );
                            if( cachedObj ) {
                                deselectObjs.push( cachedObj );
                            }
                        }
                    }
                    subPanelContext?.selectionModel.removeFromSelection( deselectObjs );
                }
            }
        }
    }
    let isRowSelected = selectedObjectsLength > 0 || _isSingleRowSelectedAfterRefresh( target );

    occmgmtUtil.updateValueOnCtxOrState( '', { isRowSelected: isRowSelected }, target, true );
};

/**
 * Update view model object in context
 * @param {object} data - data
 */
export let updateViewModelObjectInContext = function( data ) {
    if( data && data.selection ) {
        let viewModelObject = viewModelObjectSvc.constructViewModelObjectFromModelObject( cdmSvc.getObject( data.selection.uid ), null );

        let valueToUpdate = {
            modelObject: viewModelObject,
            currentState: {
                uid: viewModelObject.uid
            }
        };
        let popupOptions = data.scope?.subPanelContext?.popupOptions;
        if( popupOptions ) {
            occmgmtUtil.updateValueOnCtxOrState( '', valueToUpdate, popupOptions.inactiveContext );

            if( popupOptions.eventData ) {
                let valueToUpdateOnCbaContext;
                if( data.source === cbaConstants.CBA_SRC_CONTEXT ) {
                    valueToUpdateOnCbaContext = { srcStructure: viewModelObject };
                    //Update the source structure on ctx.cbaContext
                    occmgmtUtil.updateValueOnCtxOrState( 'srcStructure', valueToUpdateOnCbaContext.srcStructure, 'cbaContext' );
                } else if( data.source === cbaConstants.CBA_TRG_CONTEXT ) {
                    valueToUpdateOnCbaContext = { trgStructure: viewModelObject };
                    //Update the target structure on ctx.cbaContext
                    occmgmtUtil.updateValueOnCtxOrState( 'trgStructure', valueToUpdateOnCbaContext.trgStructure, 'cbaContext' );
                }
                occmgmtUtil.updateValueOnCtxOrState( '', valueToUpdateOnCbaContext, popupOptions.eventData.cbaContext );
            }
        }
    }
};

/**
 * Load properties for objects
 * @param {String} objects - list of object Uids to load given properties
 * @param {String} properties - List of properties to load
 *
 * @returns {Promise} After properties load return promise.
 */
export let loadProperties = function( objects, properties ) {
    if( objects && objects.length && properties && properties.length ) {
        let deferred = AwPromiseService.instance.defer();
        let uidsToload = [];
        _.forEach( objects, function( object ) {
            for( let index = 0; index < properties.length; index++ ) {
                const property = properties[ index ];
                if( !( object.props && object.props[ property ] ) ) {
                    uidsToload.push( object.uid );
                    break;
                }
            }
        } );
        if( uidsToload.length ) {
            dataManagementService.getProperties( uidsToload, properties ).then( function() {
                deferred.resolve( null );
            } );
            return deferred.promise;
        }
    }
    return AwPromiseService.instance.resolve( null );
};

/**
 * @param {Object} sourceObject The source object
 * @param {Object} targetObject The target object
 * @param {Object} invalidTypes List of invalid type of object and reason to open in CBA
 * @param {String} errorMessageKey error Message key to read from L10N file.
 * @returns {String} The error message text
 */
export let getErrorMessage = function( sourceObject, targetObject, invalidTypes, errorMessageKey ) {
    return AwPromiseService.instance.all( {
        uiMessages: localeService.getTextPromise( 'CadBomAlignmentMessages' )
    } ).then( function( localizedText ) {
        let deferred = AwPromiseService.instance.defer();
        let errorText;
        if( invalidTypes ) {
            let promise = loadProperties( invalidTypes, [ 'object_name' ] );
            promise.then( function() {
                let object = invalidTypes[ 0 ];
                let objNameProp = CadBomAlignmentUtil.getPropertyValueFromObject( object, 'props.object_name' );
                let objectName = objNameProp && objNameProp.dbValues.length ? objNameProp.dbValues[ 0 ] : '';
                if( errorMessageKey ) {
                    errorText = localizedText.uiMessages[ errorMessageKey ].format( objectName );
                } else {
                    if( !appCtxSvc.ctx.panelContext ) {
                        if( !sourceObject && !targetObject || invalidTypes.length === 0 ) {
                            errorText = localizedText.uiMessages.InvalidObjectsForAlignment;
                        } else if( !sourceObject ) {
                            errorText = localizedText.uiMessages.InvalidDesignForAlignment.format( objectName );
                        } else if( !targetObject ) {
                            errorText = localizedText.uiMessages.InvalidPartForAlignment.format( objectName );
                        }
                    } else {
                        if( !sourceObject ) {
                            errorText = localizedText.uiMessages.InvalidDesignDBOMForAlignment.format( objectName );
                        } else {
                            errorText = localizedText.uiMessages.InvalidPartEBOMForAlignment.format( objectName );
                        }
                    }
                }
                deferred.resolve( errorText );
            } );
        } else {
            deferred.resolve( errorText );
        }
        return deferred.promise;
    } );
};

/**
 * Get loaded VMO uid for the given underlying object uids
 *
 * @param {List} underlyingObjUids - List of uids of underlying objects
 * @param {string} contextKey - context key from which loaded VMO to fetch,
 * if not specified VMO will be fetched from both source and taget context.
 * @returns {List} - List of VMO uids
 */
export let getLoadedVMO = function( underlyingObjUids, contextKey ) {
    let outputVMOs = [];
    let contexts = [];

    if( contextKey ) {
        contexts[ 0 ] = contextKey;
    } else {
        contexts = appCtxSvc.ctx.splitView.viewKeys;
    }

    _.forEach( contexts, function( context ) {
        let loadedVMOs = appCtxSvc.ctx[ context ].vmc.loadedVMObjects;

        _.forEach( loadedVMOs, function( vmo ) {
            let awb0UnderlyingObject = CadBomAlignmentUtil.getPropertyValueFromObject( vmo, 'props.awb0UnderlyingObject' );
            if( awb0UnderlyingObject ) {
                let underlyingObjUid = awb0UnderlyingObject.dbValues[ 0 ];
                if( underlyingObjUids.includes( underlyingObjUid ) ) {
                    outputVMOs.push( vmo.uid );
                }
            }
        } );
    } );
    return outputVMOs;
};

/**
 * Register Split Mode
 */
export let registerSplitViewMode = function() {
    appCtxSvc.updatePartialCtx( cbaConstants.CTX_PATH_SPLIT_VIEW_MODE, true );
    appCtxSvc.updatePartialCtx( cbaConstants.CTX_PATH_SPLIT_VIEW_VIEWKEYS, [ cbaConstants.CBA_SRC_CONTEXT, cbaConstants.CBA_TRG_CONTEXT ] );
};

/**
 * Un-Register Split Mode
 */
export let unRegisterSplitViewMode = function() {
    let cbaViewKeys = appCtxSvc.getCtx( cbaConstants.CTX_PATH_SPLIT_VIEW_VIEWKEYS );
    _.forEach( cbaViewKeys, function( cbaViewKey ) {
        appCtxSvc.unRegisterCtx( cbaViewKey );
    } );
    appCtxSvc.unRegisterCtx( cbaConstants.CTX_PATH_SPLIT_VIEW );
};

/**
 * Check if current application is CBA
 * @returns {boolean} True if current application is CBA else False
 */
export let isCBAView = function() {
    let nameToken = appCtxSvc.getCtx( cbaConstants.CTX_PATH_SUBLOCATION_NAMETOKEN );
    return nameToken === 'com.siemens.splm.client.cba.CADBOMAlignment:CBASublocation';
};

/**
 * Check if split application is other than CBA
 * @returns {boolean} True if split application is other than CBA else False
 */
export let isNonCBASplitLocation = function() {
    let isSplitMode = appCtxSvc.getCtx( cbaConstants.CTX_PATH_SPLIT_VIEW_MODE );
    return isSplitMode && !exports.isCBAView();
};

/**
 * Get children for a given parent node
 * @param {object} parentVMO - parent VMO for which all children to be retrieved
 *
 * @returns {Array} array of child objects
 */
export let getChildrenForVMO = function( parentVMO ) {
    let childObjects = [];
    let childVMOs = occmgmtUtil.getImmediateChildrenOfGivenParentNode( parentVMO );
    if( childVMOs ) {
        for( let i = 0, len = childVMOs.length; i < len; i++ ) {
            childObjects.push( childVMOs[ i ] );
            if( childVMOs[ i ].isLeaf ) {
                continue;
            }
            childObjects = childObjects.concat( getChildrenForVMO( childVMOs[ i ] ) );
        }
    }
    return childObjects;
};

/**
 * Returns object qualifier type for view model object
 * @param {ViewModelObject} vmo - View model object to check
 * @returns {string} objectQualifierType - Object qualifier type
 */
export let getObjectQualifierTypeFromVMO = function( vmo ) {
    let objectQualifierType = '';
    if( vmo && vmo.props ) {
        let dbValues = _.get( vmo.props, 'awb0UnderlyingObject.dbValues' );
        let dbValue = dbValues && dbValues.length > 0 ? dbValues[0] : null;
        if( dbValue ) {
            let objectInVMO = cdmSvc.getObject( dbValue );
            objectQualifierType = cbaObjectTypeService.getObjectQualifierType( objectInVMO );
        }
    }
    return objectQualifierType;
};

/**
 * Check if pma1IsPartRequired or pma1IsDesignRequired property value present in given VMO.
 * @param {ViewModelObject} vmo - Object to check.
 * @param {string} objectQualifierType - Object qualifier type.
 * @returns {boolean} - returns true if pma1IsPartRequired or pma1IsDesignRequired property value present in given VMO.
 */
let _isValidDesignOrPartReqPropValue = function( vmo, objectQualifierType ) {
    if( vmo && vmo.props && objectQualifierType ) {
        let dbValues = objectQualifierType === cbaConstants.DESIGN ? _.get( vmo.props, 'pma1IsPartRequired.dbValues' ) : cbaConstants.PART ? _.get( vmo.props, 'pma1IsDesignRequired.dbValues' ) : [];
        if( dbValues && dbValues.length > 0 ) {
            return dbValues[0] === '1' || dbValues[0] === 'true';
        }
    }
    return false;
};


/**
 * Determines if the VMO is under piece part, it will not qualify for alignment.
 *
 * @param {Object} vmo - The ViewModelObject to check for alignment qualification based on its properties.
 * @returns {boolean} - Returns `false` if the VMO is under Supplier Part, otherwise returns `true`.
 */
let _isLineUnderPiecePart = function( vmo ) {    
    if ( vmo && vmo.props )
    {
        let parentDbValue = _.get( vmo.props, 'awb0Parent.dbValues' );
        if ( parentDbValue?.length > 0 )
        {
            let parentVmo = cdmSvc.getObject( parentDbValue[0] );
            if( parentVmo && parentVmo.props )
            {
                let indicatorDBValues = _.get( parentVmo.props, 'awb0AssemblyIndicator.dbValues' );
                if( indicatorDBValues?.length > 0 && indicatorDBValues[0] === 'Supplier Part' ) {
                    return true;
                }
                else {
                    return _isLineUnderPiecePart( parentVmo );
                }
            }
        }
    }
    return false;
};

/**
 * Determines if a given VMO (ViewModelObject) qualifies for alignment based on its properties(awb0SkipAlignment,pma1IsPartRequired,pma1IsDesignRequired ).
 * If the VMO has a property `awb0SkipAlignment` with a value of '1' or 'true', it will not qualify for alignment.
 * If the VMO is under Supplier Part, it will not qualify for alignment.
 *
 * @param {Object} vmo - The ViewModelObject to check for alignment qualification based on its properties.
 * @param {string} objectQualifierType - The type of object qualifier to validate against.
 * @returns {boolean} - Returns `false` if the VMO has a property `awb0SkipAlignment` with a value of '1' or 'true' or the VMO is under Supplier Part,
 * otherwise returns the result of `_isValidDesignOrPartReqPropValue`.
 */
export const isQualifyForAlignment = function( vmo, objectQualifierType ) {
    if( vmo?.props ) {
        let dbValues = _.get( vmo.props, 'awb0SkipAlignment.dbValues' );
        if( dbValues?.length > 0 && ( dbValues[ 0 ] === '1' || dbValues[ 0 ] === 'true' ) ) {
            return false;
        }
    }
    if( _isValidDesignOrPartReqPropValue( vmo, objectQualifierType ) ) {
        return !_isLineUnderPiecePart( vmo );
    } else {
        return false;
    }
};

/**
 * Check if ViewModelObject is valid for alignment. VMO will be valid if it has Part Required or Design Required property as true OR It's a SV Product Usage Occ OR is Multi Domain Part or Design object.
 * @param {ViewModelObject} vmo  - Object to check.
 * @returns {boolean} - returns true if vmo is valid for alignment else false.
 */
export let isValidObjectForAlignment = function( vmo ) {
    if( vmo && vmo.props ) {
        let objectQualifierType = exports.getObjectQualifierTypeFromVMO( vmo );
        switch( objectQualifierType ) {
            case cbaConstants.DESIGN:
            case cbaConstants.PART:
                return exports.isQualifyForAlignment( vmo, objectQualifierType );
            case cbaConstants.PRODUCT_EBOM:
                return vmo.props.awb0IsVi && vmo.props.awb0IsVi.dbValues[ 0 ] === '1';
            case cbaConstants.MULTI_DOMAIN_PART_OR_DESIGN:
                return true;
            default:
                return false;
        }
    }
    return false;
};

/**
 * Check if multiple structures are opened in CBA.
 * @returns {boolean} true if source and target both structures are opened in CBA
 */
export let areMultipleStructuresInCBA = function() {
    return appCtxSvc.getCtx( cbaConstants.CTX_PATH_ARE_MULTI_STR_IN_CBA );
};

/**
 * Gets icon image source path
 *
 * @param {Object} indicatorFile Indicator file name
 * @return {String} image source
 */
export let getIconSourcePath = function( indicatorFile ) {
    let imagePath = getBaseUrlPath() + '/image/';
    imagePath += indicatorFile;
    return imagePath;
};

/**
 * Get the message for given key from given resource file, replace the parameter and return the localized string
 *
 * @param {Object} resourceFile - File that defines the message
 * @param {String} resourceKey - The message key which should be looked-up
 * @param {String} messageParam - The message parameter
 * @returns {String} localizedValue - The localized message string
 */
export let getLocalizedMessage = ( resourceFile, resourceKey, messageParam ) => {
    // var localizedValue = null;
    let resource = resourceFile;
    let localTextBundle = localeService.getLoadedText( resource );
    let message;
    if( localTextBundle ) {
        message = localTextBundle[ resourceKey ];
    } else {
        let asyncFun = function( localTextBundle ) {
            message = localTextBundle[ resourceKey ];
        };
        localeService.getTextPromise( resource ).then( asyncFun );
    }

    message && messageParam && messageParam.forEach( function( item, index ) {
        message = message.replace( `{${index}}`, messageParam[index] );
    } );

    return message;
};

/**
  * Process errors from response
  *
  * @param {Object} response - Server response
  * @param {Object} dontClearAlignmentIndicators - true to clear alignment check indicators else false
  * @returns {Object} null if response has error else response
  */
let processErrorsAndWarnings = function( response, dontClearAlignmentIndicators ) {
    let message = '';
    let level = 0;
    let error = response.ServiceData;
    if( error && error.partialErrors ) {
        _.forEach( error.partialErrors, function( partErr ) {
            if( partErr.errorValues ) {
                _.forEach( partErr.errorValues, function( errVal ) {
                    if( errVal.code ) {
                        if( message && message.length > 0 ) {
                            message += '\n' + errVal.message;
                        } else {
                            message += errVal.message;
                        }
                    }
                    level = errVal.level;
                } );
            }
        } );
        if( level <= 1 ) {
            messagingService.showInfo( message );
            return response;
        }
        if( !dontClearAlignmentIndicators ) {
            exports.clearAlignmentCheckStatus();
        }
        messagingService.showError( message );
        return null;
    }
    return response;
};

/**
  * Returns URL parameters
  *
  * @param {Object} contextKey - source or target context key
  * @returns {Object} url parameters for the input source or target context key
  */
export const getURLParameters = function( contextKey ) {
    let urlParamObj = {
        CBASrcContext: {
            selectionQueryParamKey: 'c_uid',
            openStructureQueryParamKey: 'o_uid',
            rootQueryParamKey: 'uid',
            productContextQueryParamKey: 'pci_uid',
            csidQueryParamKey: 'c_csid',
            secondaryPageIdQueryParamKey: 'spageId',
            topElementQueryParamKey: 't_uid',
            pageIdQueryParamKey: 'pageId',
            recipeParamKey: 'recipe',
            subsetFilterParamKey: 'filter',
            alternatePwaKey: 'altPwa',
            configBaselineKey: 'configbaseline_uid'
        },
        CBATrgContext: {
            selectionQueryParamKey: 'c_uid2',
            openStructureQueryParamKey: 'o_uid2',
            rootQueryParamKey: 'uid2',
            productContextQueryParamKey: 'pci_uid2',
            csidQueryParamKey: 'c_csid2',
            secondaryPageIdQueryParamKey: 'spageId2',
            topElementQueryParamKey: 't_uid2',
            pageIdQueryParamKey: 'pageId2',
            recipeParamKey: 'recipe2',
            subsetFilterParamKey: 'filter2',
            alternatePwaKey: 'altPwa2',
            configBaselineKey: 'configbaseline_uid2'
        }
    };
    return urlParamObj[ contextKey ];
};

/**
 * Update loaded view model objects in tree data provider of occcontext
 *
 * @param {list} loadedViewModelObjects - loadedViewModelObjects
 * @param {object} occContext - occContext
 */
let updateLoadedVMOsInTreeDataProvider = function( loadedViewModelObjects, occContext ) {
    if( occContext ) {
        occContext.treeDataProvider.update( loadedViewModelObjects );
    }
};

export let updateModelObjectInContextForRevise = function( commandContext ) {
    if( commandContext && commandContext.vmo ) {
        let modelObject = cdmSvc.getObject( commandContext.vmo.uid );
        if( modelObject ) {
            let valueToUpdate = {
                currentState: {
                    uid: modelObject.uid
                }
            };

            if( commandContext.subPanelContext.occContext.viewKey === cbaConstants.CBA_SRC_CONTEXT ) {
                valueToUpdate.currentState.src_uid = modelObject.uid;
            } else if( commandContext.subPanelContext.occContext.viewKey === cbaConstants.CBA_TRG_CONTEXT ) {
                valueToUpdate.currentState.trg_uid = modelObject.uid;
            }
            occmgmtUtil.updateValueOnCtxOrState( '', valueToUpdate, commandContext.subPanelContext.occContext );
        }
    }
};

/**
 * @param {object} commandContext - commandContext
 */
export let resetStructureForAutomatedUpdate = function( commandContext ) {
    if( commandContext && commandContext.occContext ) {
        const isEBOMViewActive = commandContext.occContext.viewKey === cbaConstants.CBA_TRG_CONTEXT;
        const viewToReact = isEBOMViewActive ? cbaConstants.CBA_SRC_CONTEXT : cbaConstants.CBA_TRG_CONTEXT;
        appCtxSvc.updatePartialCtx( viewToReact + '.startFreshNavigation', true );

        eventBus.publish( 'acePwa.reset', { viewToReset: viewToReact, silentReload: true } );
        occmgmtUtil.updateValueOnCtxOrState( 'isAutomatedUpdate', true, 'cbaContext' );

        // Fix the Defect: LCS-1076247 - 3D is not loading correctly after automation update from EBOM to DBOM
        if( isEBOMViewActive ) {
            eventBus.publish( 'cba.alignmentUpdated', { viewToReact: cbaConstants.CBA_TRG_CONTEXT } );
        }
    }
};

/**
 * Check if current key is in splitView keys of CBA
 *
 * @param {object} viewKey - viewKey
 * @returns {boolean} True if current key is in splitView keys of CBA else False
 */
export let isSplitViewKey = function( viewKey ) {
    let cbaViewKeys = appCtxSvc.getCtx( cbaConstants.CTX_PATH_SPLIT_VIEW_VIEWKEYS );
    return cbaViewKeys && cbaViewKeys.includes( viewKey );
};

/**
 * Get value of given parameter from state
 *
 * @param {string} paramName Name of parameter
 * @returns {string} Value of given paramter in state
 */
export let getStateParamValue = function( paramName ) {
    return appCtxSvc.getCtx( 'state.params.' + paramName );
};

/**
 *  Check if alignment check mode is ON or OFF
 *
 * @returns {boolean} true if alignment check mode is ON else false
 */
export let isAlignmentCheckMode = function( ) {
    return CadBomAlignmentUtil.getBooleanValue( exports.getStateParamValue( 'acStatus' ) );
};

/**
 *  Check if alignment check mode in Foreground is ON or OFF
 *
 * @returns {boolean} true if alignment check mode in foreground is ON else false
 */
export let isAlignmentCheckForegroundMode = function() {
    let acMode = exports.isAlignmentCheckMode();
    if( acMode ) {
        let dataSetUID = appCtxSvc.getCtx( cbaConstants.CTX_PATH_DATASETUID );
        return !dataSetUID;
    }
    return false;
};

/**
 *  Check if alignment check mode in Background is ON or OFF
 *
 * @returns {boolean} true if alignment check mode in background is ON else false
 */
export let isAlignmentCheckBackgroundMode = function() {
    let acMode = exports.isAlignmentCheckMode();
    if( acMode ) {
        let dataSetUID = appCtxSvc.getCtx( cbaConstants.CTX_PATH_DATASETUID );
        return Boolean( dataSetUID );
    }
    return false;
};

/**
  * Returns selected object type name if outside ace and if inside ace then it returns the underlying object type name
  *
  * @param {Object} selectedObj - selected object
  * @returns {string} selected object type name if outside ace and if inside ace then it returns the underlying object type name
  */
export let getSelectedObjectTypeName = function( selectedObj ) {
    const extractNameBeforeRevision = ( selectedObjType ) => {
        const match = selectedObjType.match( /(\w+)\s?Revision/ );
        return match ? match[1] : '';
    };
    if( selectedObj ) {
        let selectedObjectTypeName;
        if( selectedObj.props && selectedObj.props.awb0UnderlyingObjectType && selectedObj.props.awb0UnderlyingObjectType.dbValues[0] ) {
            selectedObjectTypeName = selectedObj.props.awb0UnderlyingObjectType.dbValues[0];
        } else{
            selectedObjectTypeName = selectedObj.type;
        }
        return extractNameBeforeRevision( selectedObjectTypeName );
    }
    return '';
};

/**
 * Internal clear partial selection
 * @param { object } occContext
 */
const _clearTreePartialSelection = function( occContext ) {
    acePartialSelectionService.clearPartialSelectionInTree( occContext.viewKey );
    let occContextValue = { ...occContext.value };
    occContextValue.pwaSelection = occContext.treeDataProvider.selectionModel.selectionData.selected;
    occContextValue.isRowSelected = false;
    occContext.update( occContextValue );
    eventBus.publish( 'cba.refreshTree' );
};

/**
 * Clear partial selection
 * @param { object } commandContext
 */
export const clearTreePartialSelection = function( commandContext ) {
    // This will be called when user click on Clear All Selection command
    let activeOccContext = commandContext.occContext;
    let inActiveOccContext = commandContext.inactiveContext;

    const activeContext = appCtxSvc.getCtx( activeOccContext.viewKey );
    const inActiveContext = appCtxSvc.getCtx( inActiveOccContext.viewKey );

    if( activeContext?.acePartialSelection?.hiddenNode ) {
        _clearTreePartialSelection( activeOccContext );
    }

    if( inActiveContext?.acePartialSelection?.hiddenNode ) {
        _clearTreePartialSelection( inActiveOccContext );
    }
};

/**
 * CAD-BOM Occurrence Alignment Util
 */
export default exports = {
    addParametersOnUrl,
    updateCBAContextOnRowSelection,
    updateViewModelObjectInContext,
    loadProperties,
    getErrorMessage,
    getLoadedVMO,
    registerSplitViewMode,
    unRegisterSplitViewMode,
    isCBAView,
    isNonCBASplitLocation,
    getChildrenForVMO,
    getObjectQualifierTypeFromVMO,
    isValidObjectForAlignment,
    areMultipleStructuresInCBA,
    getIconSourcePath,
    getLocalizedMessage,
    processErrorsAndWarnings,
    getURLParameters,
    updateLoadedVMOsInTreeDataProvider,
    updateModelObjectInContextForRevise,
    resetStructureForAutomatedUpdate,
    isSplitViewKey,
    getStateParamValue,
    isAlignmentCheckMode,
    isAlignmentCheckForegroundMode,
    isAlignmentCheckBackgroundMode,
    getSelectedObjectTypeName,
    isTopElementSelected,
    clearTreePartialSelection,
    isQualifyForAlignment
};
