// Copyright (c) 2022 Siemens

/**
 * @module js/Awp0ShowSaveAsService
 */
import dateTimeSvc from 'js/dateTimeService';
import adapterSvc from 'js/adapterService';
import commandsSvc from 'js/command.service';
import _ from 'lodash';
import AwStateService from 'js/awStateService';
import cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import _uwPropSrv from 'js/uwPropertyService';
import commandPanelService from 'js/commandPanel.service';
import soaSvc from 'soa/kernel/soaService';
import constantsService from 'soa/constantsService';
import cmm from 'soa/kernel/clientMetaModel';
import appCtxSvc from 'js/appCtxService';
import tcSelectionUtils from 'js/tcSelectionUtils';
import vmoSvc from 'js/viewModelObjectService';

var exports = {};

/**
 * Return string value for given property value
 *
 * @param {String|Number|Object} propVal - The property valuecheck box selection.
 * @param {String} propType - The property type
 * @return {String} The stringified property value.
 */
const _convertPropValToString = function( propVal, propType ) {
    if( _.isNull( propVal ) || _.isUndefined( propVal ) ) {
        return '';
    }
    if( propType.indexOf( 'DATE' ) === 0 ) { // 'DATE' or 'DATEARRAY'
        return dateTimeSvc.formatUTC( propVal );
    } else if( propType.indexOf( 'INTEGER' ) === 0 || propType.indexOf( 'DOUBLE' ) === 0 ) { // 'INTEGER', 'DOUBLE' and their 'ARRAY'
        return String( propVal );
    } else if( propType.indexOf( 'BOOLEAN' ) === 0 ) { // 'BOOLEAN' or 'BOOLEANARRAY'
        return propVal ? '1' : '0';
    } else if( propType.indexOf( 'CHAR' ) === 0 || propType.indexOf( 'STRING' ) === 0 ) { // 'STRING', 'CHAR' and their 'ARRAY'
        return propVal;
    } else if( propVal.uid && propVal.type && propVal.modelType && propVal.props ) { // Model Object
        return propVal.uid;
    }

    return '';
};

/**
 * Process the deep copy data for user's choice in check box
 *
 * @param {ObjectArray} deepCopyDataArr - The deep copy data array
 * @param {Object} data - The vm data
 * @param {Boolean} copyOverEnabled - true, if copy over is enabled; false, otherwise
 * @param {Object} xrtState - xrt state atomic data
 */
var _processDeepCopyData = function( deepCopyDataArr, data, copyOverEnabled, xrtState, xrtType ) {
    _.forEach( deepCopyDataArr, function( deepCopyData ) {
        if( copyOverEnabled && !deepCopyData.isRequired ) {
            var checkBoxPropName = deepCopyData.propertyName + '_checkbox';
            if( xrtState && xrtState.copyOptions ) {
                let defaultCopyOptionProps = {};
                xrtState.copyOptions.forEach( ( copyOption ) => {
                    if( copyOption ) {
                        let propName = Object.keys( copyOption )[0];
                        defaultCopyOptionProps[ propName ] = copyOption[ propName ];
                    }
                } );

                let copyOptionProp = xrtState.copyOptionProps ? xrtState.copyOptionProps[ checkBoxPropName ] : defaultCopyOptionProps[ checkBoxPropName ];
                if( copyOptionProp && !copyOptionProp.dbValue ) {
                    deepCopyData.copyAction = 'NoCopy';
                }
            }
        }

        if( deepCopyData.attachedObject && xrtType === 'SAVEAS' ) {
            if( !deepCopyData.saveAsInput ) {
                deepCopyData.saveAsInput = {};
            }
            deepCopyData.saveAsInput.boName = deepCopyData.attachedObject.type;
        }

        if( _.isArray( deepCopyData.childDeepCopyData ) ) {
            _processDeepCopyData( deepCopyData.childDeepCopyData, data, copyOverEnabled, xrtState, xrtType );
        }
    } );
};

/**
 * Process the deep copy data for user's choice in check box
 *
 * @param {Object} data - The vm data
 * @param {Boolean} copyOverEnabled - true, if copy over is enabled; false, otherwise
 * @param {Object} xrtState - xrt state atomic data
 * @param {Object} viewModelObjects - array of view model objects
 * @param {String} xrtType - type of xrt Revise/SaveAs
 *
 * @returns {Array} array of deep copy objects
 */
const _processDeepCopyData2 = function( data, copyOverEnabled, xrtState, viewModelObjects, xrtType ) {
    let deepCopyDataArray = [];
    _.forEach( viewModelObjects, function( vmObject ) {
        let deepCopyData = {
            attachedObject: {
                type: vmObject.type,
                uid: vmObject.uid
            },
            childDeepCopyData: [],
            copyAction: vmObject.props?.action?.dbValue,
            copyRelations: vmObject.props?.deep_copy_copy_relations?.dbValue,
            isRequired: vmObject.props?.deep_copy_is_required?.dbValue,
            isTargetPrimary: vmObject.props?.deep_copy_is_target_primary?.dbValue,
            propertyName: vmObject.props?.relation?.dbValue,
            propertyType: vmObject.props?.deep_copy_property_type?.dbValue
        };

        if( xrtType === 'REVISE' ) {
            deepCopyData.operationInputTypeName = '';
            deepCopyData.operationInputs = {};
        } else if( xrtType === 'SAVEAS' ) {
            deepCopyData.saveAsInput = { boName: vmObject.type };
            deepCopyData.saveAsInputTypeName = '';
        }

        if( vmObject.children && _.isArray( vmObject.children ) ) {
            deepCopyData.childDeepCopyData = _processDeepCopyData2( data, copyOverEnabled, xrtState, vmObject.children, xrtType );
        }

        deepCopyDataArray.push( deepCopyData );
    } );

    return deepCopyDataArray;
};

var _typeToPlace = {
    CHAR: 'stringProps',
    STRING: 'stringProps',
    STRINGARRAY: 'stringArrayProps',
    BOOLEAN: 'boolProps',
    BOOLEANARRAY: 'boolArrayProps',
    DATE: 'dateProps',
    DATEARRAY: 'dateArrayProps',
    OBJECT: 'tagProps',
    OBJECTARRAY: 'tagArrayProps',
    DOUBLE: 'doubleProps',
    DOUBLEARRAY: 'doubleArrayProps',
    INTEGER: 'intProps',
    INTEGERARRAY: 'intArrayProps'
};

/**
 * Add given property to SaveAsInput structure
 *
 * @param {Object} saveAsInputIn - The SaveAsInput structure
 * @param {String} propName - The property name
 * @param {Object} vmProp - The VM property
 */
var _setProperty = function( saveAsInputIn, propName, vmProp ) {
    var place = _typeToPlace[ vmProp.type ];
    if( _.isUndefined( saveAsInputIn[ place ] ) ) {
        saveAsInputIn[ place ] = {};
    }

    switch ( vmProp.type ) {
        case 'STRING':
        case 'STRINGARRAY':
        case 'BOOLEAN':
        case 'BOOLEANARRAY':
        case 'DOUBLE':
        case 'DOUBLEARRAY':
        case 'INTEGER':
        case 'INTEGERARRAY':
            saveAsInputIn[ place ][ propName ] = vmProp.dbValue;
            break;
        case 'DATE':
            saveAsInputIn[ place ][ propName ] = dateTimeSvc.formatUTC( vmProp.dbValue );
            break;
        case 'DATEARRAY':
            var rhs = [];
            _.forEach( vmProp.dbValue, function( val ) {
                rhs.push( dateTimeSvc.formatUTC( val ) );
            } );
            saveAsInputIn[ place ][ propName ] = rhs;
            break;
        case 'OBJECT':
            var objectValue = vmProp.dbValue;
            if( _.isString( vmProp.dbValue ) ) {
                objectValue = { uid: vmProp.dbValue };
            }
            saveAsInputIn[ place ][ propName ] = objectValue;
            break;
        case 'OBJECTARRAY':
            rhs = [];
            _.forEach( vmProp.dbValue, function( val ) {
                var objectValue = val;
                if( _.isString( val ) ) {
                    objectValue = { uid: val };
                }
                rhs.push( objectValue );
            } );
            saveAsInputIn[ place ][ propName ] = rhs;
            break;
        default:
            saveAsInputIn.stringProps[ propName ] = vmProp.dbValue;
            break;
    }
};

/**
 * Get the deep copy data for the given property name
 *
 * @param {ObjectArray} deepCopyDataArr - The deep copy data array
 * @param {String} targetPropName - The property name
 * @param {String} parentUid - parent Uid to find the deepCopy object
 *
 * @returns {Object} deep copy data
 */
const _getDeepCopyDataForProp = ( deepCopyDataArr, targetPropName, parentUid ) => {
    let dcd;
    let colonIdx = targetPropName.indexOf( ':' );
    let propToFind = targetPropName.substring( 0, colonIdx );
    let remainder = targetPropName.substring( colonIdx + 1 );
    for( let id in deepCopyDataArr ) {
        let deepCopyData = deepCopyDataArr[ id ];
        if( parentUid && parentUid === deepCopyData.attachedObject?.uid ) {
            dcd = deepCopyData;
            break;
        } else {
            if( propToFind && deepCopyData.propertyName === propToFind ) {
                if( remainder.indexOf( ':' ) > 0 ) {
                    let childDeepCopyData = deepCopyData.childDeepCopyData;
                    if( _.isArray( childDeepCopyData ) ) {
                        dcd = _getDeepCopyDataForProp( childDeepCopyData, remainder, childDeepCopyData?.attachedObject?.uid );
                        break;
                    }
                } else {
                    dcd = deepCopyData;
                    break;
                }
            }

            let childDeepCopyData = deepCopyData?.childDeepCopyData;
            if( childDeepCopyData && _.isArray( childDeepCopyData ) && childDeepCopyData.length > 0 ) {
                dcd = _getDeepCopyDataForProp( childDeepCopyData, remainder, parentUid );
                if( dcd ) {
                    break;
                }
            }
        }
    }


    return dcd;
};

const _getModifiedPropsForSaveasRevise = ( dataSource, xrtState, disableDeepCopy ) => {
    let vmoEditableProps = dataSource.getAllEditableProperties();
    let modifiedDeepCopyProps = [];
    if( !disableDeepCopy ) {
        //exclude deepCopy related properties
        vmoEditableProps = vmoEditableProps.filter( vmProp => {
            return vmProp.parentUid && vmProp.parentUid === xrtState?.xrtVMO?.uid;
        } );
        modifiedDeepCopyProps = dataSource.getAllModifiedProperties();
        modifiedDeepCopyProps = modifiedDeepCopyProps ? modifiedDeepCopyProps.filter( vmProp => {
            return vmProp.parentUid && vmProp.parentUid !== xrtState?.xrtVMO?.uid;
        } ) : [];
    }

    const updatedProps = vmoEditableProps.concat( ...modifiedDeepCopyProps );
    return updatedProps.filter( ( prop, index ) => updatedProps.indexOf( prop ) === index );
};

const _getExcludedDeepCopyObjects = ( deepCopyViewModelObjects, xrtState, vmoUid ) => {
    if( !xrtState || !xrtState.excludedDeepCopies ) {
        return [];
    }

    if( !deepCopyViewModelObjects || deepCopyViewModelObjects.length === 0 ) {
        if( vmoUid && xrtState.excludedDeepCopies[vmoUid] ) {
            return xrtState.excludedDeepCopies[vmoUid];
        }
        return [];
    }

    const excludedRootDeepCopyObjs = [];
    let shouldAddDefaultExclusions = false;

    deepCopyViewModelObjects.forEach( obj => {
        if( obj.levelNdx === 0 ) {
            excludedRootDeepCopyObjs.push( ...xrtState.excludedDeepCopies[obj.uid] );
        } else if( xrtState.excludedDeepCopies[obj.uid] ) {
            obj.children = obj.children ? obj.children.concat( xrtState.excludedDeepCopies[obj.uid] ) : [].concat( xrtState.excludedDeepCopies[obj.uid] );
        } else {
            shouldAddDefaultExclusions = true;
        }
    } );

    if( vmoUid && shouldAddDefaultExclusions ) {
        const rootNodeUid = deepCopyViewModelObjects.find( obj => obj.levelNdx === 0 )?.uid;

        if( vmoUid !== rootNodeUid ) {
            excludedRootDeepCopyObjs.push( ...xrtState.excludedDeepCopies[ vmoUid ] ?? [] );
        }
    }

    return excludedRootDeepCopyObjs;
};

/**
 * Adapt and update context, then activate the command panel
 *
 * @param {Array} selectedObj - array of selected objects
 * @param {String} commandId - ID of the command to open.
 * @param {String} location - Which panel to open the command in
 * @param {Boolean} openNewRevision -
 * @param {Boolean} showOpenNewRevisionCheckbox -
 * @param {Boolean} push - Optional parameter to push workarea content when opening command panel
 * @param {Boolean} closeWhenCommandHidden - Optional parameter to disable the automatic closing of the panel when a command is hidden. Defaults to true.
 * @param {Object} config - Optional parameter to override the configuration attributes of sidenav, which includes width, height and slide.
 */
export let updateSaveAsContextAndActivateCommandPanel = function( input ) {
    if( !input.selectedObj ) {
        input.selectedObj = tcSelectionUtils.getSourceObject( input.localSelectionData, input.activeSelection );
    }
    const dialogAction = input.commandContext?.dialogAction;
    var selectedObj = input.selectedObj;
    var commandId = input.commandId;
    var location = input.location;
    var openNewRevision = input.openNewRevision;
    var showOpenNewRevisionCheckbox = input.showOpenNewRevisionCheckbox;
    var push = input.push;
    var closeWhenCommandHidden = input.closeWhenCommandHidden;
    var config = input.config;
    const copyOverEnabled = input.copyOverEnabled;
    var selectedObjs = [];
    selectedObjs.push( selectedObj );
    var adaptedObjsPromise = adapterSvc.getAdaptedObjects( selectedObjs );
    adaptedObjsPromise.then( function( adaptedObjs ) {
        var context = {
            SelectedObjects: [ adaptedObjs[ 0 ] ]
        };
        if( openNewRevision === undefined ) {
            openNewRevision = true;
        }
        if( showOpenNewRevisionCheckbox === undefined ) {
            showOpenNewRevisionCheckbox = true;
        }
        if( copyOverEnabled ) {
            context.CopyOverEnabled = copyOverEnabled;
        }
        context.OpenNewRevision = openNewRevision;
        context.showOpenNewRevisionCheckbox = showOpenNewRevisionCheckbox;

        if( commandId ) {
            if( dialogAction ) {
                context.isSaveAsReviseDialog = true;
                let localOptions = {
                    view: commandId,
                    parent: '.aw-layout-workarea',
                    width: 'STANDARD',
                    height: 'FULL',
                    isCloseVisible: false,
                    subPanelContext: context
                };
                input.push === true && ( localOptions.push = true );
                dialogAction.show( localOptions  );
            } else {
                commandPanelService.activateCommandPanel( commandId, location, context, push, closeWhenCommandHidden, config );
            }
        }
    } );
};


/**
 * Execute a command with the given arguments
 *
 * @param {String} commandId - Command id
 * @param {String|String[]} commandArgs -
 * @param {Object} commandContext - command context
 * @param {Object} runActionWithViewModel - runActionWithViewModel
 */
export let saveAsComplete = function( commandId, commandArgs, commandContext, runActionWithViewModel ) {
    commandsSvc.executeCommand( commandId, commandArgs, null, commandContext, runActionWithViewModel );
};

/**
 * update edit state in url
 */
export let updateEditStateInURL = function() {
    var navigationParam = AwStateService.instance.params;
    navigationParam.edit = '';
    AwStateService.instance.go( '.', navigationParam, { location: 'replace' } );
};

/**
 * Process next level child vmnodes for finalDeepCopyObjs
 *
 * @param {Array} finalDeepCopyObjs - array of final deep copy objs
 * @param {Object} nextLevelChildVmNodes - Object of uids with unprocessed child vmnodes
 * @param {boolean} isTop - determines if the end of the recursive function has finished
 * @returns {Array} finalDeepCopyObjs - array of final deep copy objs
 */
const processNextLevelChildVmNodes = ( finalDeepCopyObjs, nextLevelChildVmNodes, isTop ) => {
    for( const idx in finalDeepCopyObjs ) {
        if( finalDeepCopyObjs[idx].uid && nextLevelChildVmNodes.hasOwnProperty( finalDeepCopyObjs[idx].uid ) ) {
            if( finalDeepCopyObjs[idx].children ) {
                let currentChildren = finalDeepCopyObjs[idx].children;
                let nextLevelChildren = nextLevelChildVmNodes[ `${finalDeepCopyObjs[idx].uid }` ];
                for( const idx2 in currentChildren ) {
                    if( currentChildren[idx2].props.action.dbValue === 'CopyAsObject' ) {
                        if( currentChildren[idx2].children ) {
                            processNextLevelChildVmNodes( currentChildren[idx2].children, nextLevelChildVmNodes, false );
                        } else{
                            let currChildUid = currentChildren[idx2].uid;
                            for( const idx3 in nextLevelChildren ) {
                                if( nextLevelChildren[idx3].uid === currChildUid && nextLevelChildren[idx3].children ) {
                                    currentChildren[idx2].children = nextLevelChildren[idx3].children;
                                }
                            }
                        }
                    }
                }
            } else{
                finalDeepCopyObjs[idx].children = nextLevelChildVmNodes[ `${finalDeepCopyObjs[idx].uid }` ];
            }
        }
    }
    if( isTop ) {
        return finalDeepCopyObjs;
    }
};

/**
 * Get the saveAsInput for saveAsObjectAndRelate SOA
 *
 * @param {Object} data - The data
 * @param {Object} xrtContext - The XRT context
 * @param {Object} deepCopyDatas - The deepCopyDatas
 * @param {Object} editHandler - The editHandler
 * @param {Object} xrtState - xrt state atomic data
 * @param {Object} disableDeepCopy - flag to determine disabling deep copy table
 * @return {Object} The saveAsInput
 */
export let getSaveAsInput = function( data, xrtContext, deepCopyDatas, editHandler, xrtState, disableDeepCopy ) {
    let targetObject = xrtContext.SelectedObjects[ 0 ];
    let deepCopyDataArr;

    if( !disableDeepCopy && xrtState?.dpRef?.current ) {
        let dataSource = editHandler?.getDataSource();
        let editHandlerSourceObjects = dataSource?.getLoadedViewModelObjects();
        let vmObjs = vmoSvc.getLoadedAndCachedViewModelObjects( editHandlerSourceObjects );

        //only include deepCopy related objects
        let deepCopyViewModelObjects = vmObjs.filter( vmObj => {
            return vmObj.uid !== xrtState.xrtVMO.uid && vmObj.levelNdx <= 1;
        } );

        const excludedRootDeepCopyObjs = _getExcludedDeepCopyObjects( deepCopyViewModelObjects, xrtState );

        const unprocessedDeepCopyObjs = deepCopyViewModelObjects
            .filter( obj => { return obj.levelNdx !== 0; } )
            .concat( excludedRootDeepCopyObjs );
        let finalDeepCopyObjs = processNextLevelChildVmNodes( unprocessedDeepCopyObjs, xrtState.nextLevelChildVmNodes, true );
        deepCopyDataArr = _processDeepCopyData2( data, xrtContext.CopyOverEnabled === 'true', xrtState, finalDeepCopyObjs, 'SAVEAS' );
    } else {
        deepCopyDataArr = _.clone( deepCopyDatas );
        _processDeepCopyData( deepCopyDataArr, data, xrtContext.CopyOverEnabled === 'true', xrtState, 'SAVEAS' );
    }


    // Prepare saveAsInput
    var saveAsInputIn = {
        boName: targetObject.type
    };

    if( editHandler ) {
        let dataSource = editHandler.getDataSource();
        if( dataSource ) {
            const modifiedViewModelProperties = _getModifiedPropsForSaveasRevise( dataSource, xrtState, disableDeepCopy );
            _.forEach( modifiedViewModelProperties, function( vmProp ) {
                let propName = vmProp.propertyName;
                const isDeepCopyProp = xrtState ? vmProp.parentUid !== xrtState?.xrtVMO?.uid : false;
                // Check if the property is DCP
                var isDCP = false;
                var propertyNameTokens = propName.split( '.' );
                var parentPropertyName = '';
                var leafPropName = '';
                for( var i = 0; i < propertyNameTokens.length; i++ ) {
                    if( propertyNameTokens[ i ].startsWith( 'REF' ) ) {
                        isDCP = true;
                        var index = propertyNameTokens[ i ].indexOf( ',' );
                        parentPropertyName = propertyNameTokens[ i ].substring( 4, index ).trim();
                        //revisit:YULU: No need parentTypeName from DCP in Save As action for Deep Copy Data
                        //like AW2_Prop_SupportSvAI in REF(items_tag,AW2_Prop_SupportSvAI).item_id
                    } else {
                        leafPropName = propertyNameTokens[ i ];
                    }
                }
                if( isDCP && !vmProp ) {
                    vmProp = _getVMPropFromModifiedProperties( leafPropName, modifiedViewModelProperties );
                }

                // If the property is modified, or is auto assignable (it has been already auto-assigned),
                // then it qualifies to be added to saveAsInputs.
                if( vmProp && ( _uwPropSrv.isModified( vmProp ) || vmProp.isAutoAssignable ) ) {
                    if( isDCP || isDeepCopyProp ) {
                        var compPropName = parentPropertyName + ':' + leafPropName;
                        // For item_id property, properties need to be added under 'items_tag' relation i.e. Item
                        if( vmProp.propertyName === 'item_id' ) {
                            let mo = cdm.getObject( vmProp.parentUid );
                            if( mo && mo.props.items_tag && mo.props.items_tag.dbValues && mo.props.items_tag.dbValues.length > 0 ) {
                                let deepCopyData = _getDeepCopyDataForProp( deepCopyDataArr, compPropName, mo.props.items_tag.dbValues[0] );
                                if( deepCopyData && deepCopyData.saveAsInput ) {
                                    _setProperty( deepCopyData?.saveAsInput, leafPropName, vmProp );
                                }
                            }
                        } else {
                            let deepCopyData = _getDeepCopyDataForProp( deepCopyDataArr, compPropName, vmProp.parentUid );
                            if( deepCopyData && deepCopyData.saveAsInput ) {
                                _setProperty( deepCopyData.saveAsInput, leafPropName, vmProp );
                            }
                        }
                    } else {
                        _setProperty( saveAsInputIn, propName, vmProp );
                    }
                }
            } );

            if( dataSource.getDeclViewModel().customPanelInfo ) {
                _.forEach( dataSource.getDeclViewModel().customPanelInfo, function( customPanelVMData ) {
                    var oriVMData = customPanelVMData._internal.origDeclViewModelJson.data;
                    _.forEach( customPanelVMData, function( propVal, propName ) {
                        if( _.has( oriVMData, propName ) ) {
                            _setProperty( saveAsInputIn, propName, propVal );
                        }
                    } );
                } );
            }
        }
    }

    return [ {
        targetObject: targetObject,
        saveAsInput: saveAsInputIn,
        deepCopyDatas: deepCopyDataArr
    } ];
};

/**
 * Get the saveAsInput for Add a Copy for saveAsObjectAndRelate SOA
 *
 * @param {Object} data - The data
 * @param {Object} xrtContext - The XRT context
 * @param {Object} deepCopyDatas - The deepCopyDatas
 * @param {Object} editHandler - The editHandler
 * @param {Object} xrtState - xrt state atomic data
 * @return {Object} The saveAsInput
 */
export let getSaveAsInputForAddCopy = function( data, xrtContext, deepCopyDatas, editHandler, xrtState ) {
    var ctxObj = xrtContext.sourceObjects[ 0 ];
    let deepCopyDataArr;

    if( xrtState?.dpRef?.current ) {
        let dataSource = editHandler.getDataSource();
        let editHandlerSourceObjects = dataSource?.getLoadedViewModelObjects();
        let vmObjs = vmoSvc.getLoadedAndCachedViewModelObjects( editHandlerSourceObjects );

        //only include deepCopy related objects
        const deepCopyViewModelObjects = vmObjs.filter( vmObj => {
            return vmObj.uid !== xrtState.xrtVMO.uid && vmObj.levelNdx <= 1;
        } );

        const excludedRootDeepCopyObjs = _getExcludedDeepCopyObjects( deepCopyViewModelObjects, xrtState );
        const unprocessedDeepCopyObjs = deepCopyViewModelObjects
            .filter( obj => { return obj.levelNdx !== 0; } )
            .concat( excludedRootDeepCopyObjs );

        let finalDeepCopyObjs = processNextLevelChildVmNodes( unprocessedDeepCopyObjs, xrtState.nextLevelChildVmNodes, true );
        deepCopyDataArr = _processDeepCopyData2( data, xrtContext.CopyOverEnabled === 'true', xrtState, finalDeepCopyObjs, 'SAVEAS' );
    } else {
        deepCopyDataArr = _.clone( deepCopyDatas );
        _processDeepCopyData( deepCopyDataArr, data, xrtContext.CopyOverEnabled === 'true', xrtState, 'SAVEAS' );
    }
    // Prepare saveAsInput
    var saveAsInputIn = {
        boName: ctxObj.type
    };

    if( editHandler ) {
        let dataSource = editHandler.getDataSource();
        if( dataSource ) {
            const modifiedViewModelProperties = _getModifiedPropsForSaveasRevise( dataSource, xrtState );
            _.forEach( modifiedViewModelProperties, function( vmProp ) {
                let propName = vmProp.propertyName;
                const isDeepCopyProp = xrtState ? vmProp.parentUid !== xrtState?.xrtVMO?.uid : false;
                // Check if the property is DCP
                var isDCP = false;
                var propertyNameTokens = propName.split( '.' );
                var parentPropertyName = '';
                var leafPropName = '';
                for( var i = 0; i < propertyNameTokens.length; i++ ) {
                    if( propertyNameTokens[ i ].startsWith( 'REF' ) ) {
                        isDCP = true;
                        var index = propertyNameTokens[ i ].indexOf( ',' );
                        parentPropertyName = propertyNameTokens[ i ].substring( 4, index ).trim();
                        //revisit:YULU: No need parentTypeName from DCP in Save As action for Deep Copy Data
                        //like AW2_Prop_SupportSvAI in REF(items_tag,AW2_Prop_SupportSvAI).item_id
                    } else {
                        leafPropName = propertyNameTokens[ i ];
                    }
                }
                if( isDCP && !vmProp ) {
                    vmProp = _getVMPropFromModifiedProperties( leafPropName, modifiedViewModelProperties );
                }

                // If the property is modified, or is auto assignable (it has been already auto-assigned),
                // then it qualifies to be added to saveAsInputs.
                if( vmProp && ( _uwPropSrv.isModified( vmProp ) || vmProp.isAutoAssignable ) ) {
                    if( isDCP || isDeepCopyProp ) {
                        var compPropName = parentPropertyName + ':' + leafPropName;
                        // For item_id property, properties need to be added under 'items_tag' relation i.e. Item
                        if( vmProp.propertyName === 'item_id' ) {
                            let mo = cdm.getObject( vmProp.parentUid );
                            if( mo && mo.props.items_tag && mo.props.items_tag.dbValues && mo.props.items_tag.dbValues.length > 0 ) {
                                let deepCopyData = _getDeepCopyDataForProp( deepCopyDataArr, compPropName, mo.props.items_tag.dbValues[0] );
                                if( deepCopyData && deepCopyData.saveAsInput ) {
                                    _setProperty( deepCopyData?.saveAsInput, leafPropName, vmProp );
                                }
                            }
                        } else {
                            let deepCopyData = _getDeepCopyDataForProp( deepCopyDataArr, compPropName, vmProp.parentUid );
                            if( deepCopyData && deepCopyData.saveAsInput ) {
                                _setProperty( deepCopyData.saveAsInput, leafPropName, vmProp );
                            }
                        }
                    } else {
                        _setProperty( saveAsInputIn, propName, vmProp );
                    }
                }
            } );

            if( dataSource.getDeclViewModel().customPanelInfo ) {
                _.forEach( dataSource.getDeclViewModel().customPanelInfo, function( customPanelVMData ) {
                    var oriVMData = customPanelVMData._internal.origDeclViewModelJson.data;
                    _.forEach( customPanelVMData, function( propVal, propName ) {
                        if( _.has( oriVMData, propName ) ) {
                            _setProperty( saveAsInputIn, propName, propVal );
                        }
                    } );
                } );
            }
        }
    }

    return [ {
        targetObject: ctxObj,
        saveAsInput: saveAsInputIn,
        deepCopyDatas: deepCopyDataArr
    } ];
};

let _getVMPropFromModifiedProperties = function( propName, modifiedProperties ) {
    var vmProp = {};
    if( propName && _.isArray( modifiedProperties ) ) {
        vmProp = modifiedProperties.find( modifiedProp => modifiedProp.propertyName === propName );
    }
    return vmProp;
};

/**
 * Get the newly created Item created by saveAsObjectAndRelate SOA
 *
 * @param {Object} response - The response of saveAsObjectAndRelate SOA
 * @return {Object} The newly created object
 */
export let getNewCreatedObject = function( response ) {
    if( response && response.ServiceData && response.ServiceData.created ) {
        var position = response.ServiceData.created.length - 2;
        return response.output[ 0 ].objects[ position ];
    }
};

/**
 * Get the newly created Item created by saveAsObjectAndRelate SOA
 *
 * @param {Object} response - The response of saveAsObjectAndRelate SOA
 * @return {Object} The newly created object
 */
export let getNewCreatedObjectForAddCopy = function( response ) {
    if( response && response.ServiceData && response.ServiceData.created ) {
        var position = response.ServiceData.created.length - 2;
        return [ response.output[ 0 ].objects[ position ] ];
    }
};

/**
 * Get the newly created Item created by saveAsObjectAndRelate SOA
 *
 * @param {Object} response - The response of saveAsObjectAndRelate SOA
 * @return {Object} The newly created object
 */
export let getRevToSelectForAddCopy = function( response ) {
    var newObjects = [];

    if( response.output ) {
        for( var index in response.output ) {
            if( response.output[ index ].objects ) {
                var newObject = response.output[ index ].objects[ 0 ];
                newObject = cdm.getObject( newObject.uid );
                // If the created Object is a subtype of Item, then take its item revision
                if( newObject.modelType.typeHierarchyArray.indexOf( 'Item' ) > -1 ) {
                    var itemRevPastedOnTarget = true;
                    if( newObject.modelType.constantsMap &&
                        newObject.modelType.constantsMap.Fnd0ItemRevPasteOnTargetUponCreate ) {
                        if( newObject.modelType.constantsMap.Fnd0ItemRevPasteOnTargetUponCreate === 'false' ) {
                            itemRevPastedOnTarget = false;
                        }
                    }
                    if( itemRevPastedOnTarget ) {
                        var createdItemObj = cdm.getObject( newObject.uid );
                        if( createdItemObj && createdItemObj.props && createdItemObj.props.revision_list ) {
                            newObject = cdm.getObject( createdItemObj.props.revision_list.dbValues[ 0 ] );
                        } else if( response.output[ index ].objects.length >= 3 ) {
                            // TODO: remove this when all consumers load revision_list property
                            // Assuming the [2] element is Item Revision !!!
                            newObject = response.output[ index ].objects[ 2 ];
                        }
                    }
                }
                newObjects.push( newObject );
            }
        }
    }
    return newObjects;
};

/**
 * Get the reviseInput for revideObjects SOA
 *
 * @param {Object} editHandler - EditHandler.
 * @return {Object} The reviseInput
 */
export let getReviseInputs = ( editHandler ) => {
    let reviseInputs = {};
    if( editHandler ) {
        let dataSource = editHandler.getDataSource();
        if( dataSource ) {
            let modifiedViewModelProperties = dataSource.getAllEditableProperties();
            _.forEach( modifiedViewModelProperties, function( vmProp ) {
                if( vmProp && ( vmProp.isAutoAssignable || _uwPropSrv.isModified( vmProp ) ) ) {
                    var propVal = vmProp.dbValue;
                    var reviseInputVal = [];
                    if( _.isArray( propVal ) ) {
                        _.forEach( propVal, function( val ) {
                            reviseInputVal.push( _convertPropValToString( val, vmProp.type ) );
                        } );
                    } else {
                        reviseInputVal.push( _convertPropValToString( propVal, vmProp.type ) );
                    }
                    reviseInputs[ vmProp.propertyName ] = reviseInputVal;
                }
            } );
            if( dataSource.getDeclViewModel().customPanelInfo ) {
                _.forEach( dataSource.getDeclViewModel().customPanelInfo, function( customPanelVMData ) {
                    let oriVMData = customPanelVMData._internal.origDeclViewModelJson.data;
                    _.forEach( customPanelVMData, function( propVal, propName ) {
                        if( _.has( oriVMData, propName ) ) {
                            reviseInputs[ propName ] = [];
                            if( _.isArray( propVal.dbValue ) ) {
                                _.forEach( propVal.dbValue, function( val ) {
                                    reviseInputs[ propName ].push( _convertPropValToString( val, propVal.type ) );
                                } );
                            } else {
                                reviseInputs[ propName ].push( _convertPropValToString( propVal.dbValue, propVal.type ) );
                            }
                        }
                    } );
                } );
            }
        }
    }

    return reviseInputs;
};

/**
 * Get the reviseInput for revideObjects SOA
 *
 * @param {Object} data - data object
 * @param {Object} subPanelContext - subPanelContext
 * @param {Object} editHandler - EditHandler of revise
 * @param {Object} xrtState - Atomic data
 * @return {Object} The reviseInput
 */
export let getReviseInputs2 = ( data, subPanelContext, editHandler, xrtState, selectedObject ) => {
    const selectedObjectIn = selectedObject || subPanelContext.SelectedObjects[0];
    let deepCopyDataArr;
    if( xrtState.dpRef?.current ) {
        let dataSource = editHandler.getDataSource();
        let editHandlerSourceObjects = dataSource?.getLoadedViewModelObjects();
        let vmObjs = vmoSvc.getLoadedAndCachedViewModelObjects( editHandlerSourceObjects );

        //only include deepCopy related objects
        let deepCopyViewModelObjects = vmObjs.filter( vmObj => {
            if( vmObj.levelNdx !== null && vmObj.levelNdx !== undefined ) {
                return vmObj.uid !== xrtState.xrtVMO.uid && vmObj.levelNdx <= 1;
            }
            return vmObj.uid !== xrtState.xrtVMO.uid && vmObj.uid !== selectedObjectIn.uid;
        } );

        const excludedRootDeepCopyObjs = _getExcludedDeepCopyObjects( deepCopyViewModelObjects, xrtState, selectedObjectIn.uid );

        const unprocessedDeepCopyObjs = deepCopyViewModelObjects
            .filter( obj => { return obj.levelNdx !== 0; } ) // root treeNode object is not deep copy data
            .concat( excludedRootDeepCopyObjs );

        let finalDeepCopyObjs = processNextLevelChildVmNodes( unprocessedDeepCopyObjs, xrtState.nextLevelChildVmNodes, true );
        deepCopyDataArr = _processDeepCopyData2( data, subPanelContext.CopyOverEnabled === 'true', xrtState, finalDeepCopyObjs, 'REVISE' );
    } else {
        deepCopyDataArr = _.clone( xrtState.deepCopyDatas );
        _processDeepCopyData( deepCopyDataArr, data, subPanelContext.CopyOverEnabled === 'true', xrtState, 'REVISE' );
    }
    let reviseInputs = {};
    if( editHandler ) {
        let dataSource = editHandler.getDataSource();
        if( dataSource ) {
            const modifiedViewModelProperties = _getModifiedPropsForSaveasRevise( dataSource, xrtState );
            _.forEach( modifiedViewModelProperties, function( vmProp ) {
                const isDeepCopyProp = vmProp.parentUid !== xrtState?.xrtVMO?.uid;
                if( vmProp && ( vmProp.isAutoAssignable || _uwPropSrv.isModified( vmProp ) ) ) {
                    if( isDeepCopyProp ) {
                        // For item_id property, properties need to be added under 'items_tag' relation i.e. Item
                        if( vmProp.propertyName === 'item_id' ) {
                            let mo = cdm.getObject( vmProp.parentUid );
                            if( mo && mo.props.items_tag && mo.props.items_tag.dbValues && mo.props.items_tag.dbValues.length > 0 ) {
                                let deepCopyData = _getDeepCopyDataForProp( deepCopyDataArr, vmProp.propertyName, mo.props.items_tag.dbValues[0] );
                                if( deepCopyData && deepCopyData.operationInputs ) {
                                    let returnVal = {};
                                    _setProperty( returnVal, vmProp.propertyName, vmProp );
                                    const propType = _typeToPlace[ vmProp.type ];
                                    deepCopyData.operationInputs[ vmProp.propertyName ] = [ returnVal[ propType ][ vmProp.propertyName ] ];
                                }
                            }
                        } else {
                            let deepCopyData = _getDeepCopyDataForProp( deepCopyDataArr, vmProp.propertyName, vmProp.parentUid );
                            if( deepCopyData && deepCopyData.operationInputs ) {
                                let returnVal = {};
                                _setProperty( returnVal, vmProp.propertyName, vmProp );
                                const propType = _typeToPlace[ vmProp.type ];
                                deepCopyData.operationInputs[ vmProp.propertyName ] = [ returnVal[ propType ][ vmProp.propertyName ] ];
                            }
                        }
                    } else {
                        var propVal = vmProp.dbValue;
                        var reviseInputVal = [];
                        if( _.isArray( propVal ) ) {
                            _.forEach( propVal, function( val ) {
                                reviseInputVal.push( _convertPropValToString( val, vmProp.type ) );
                            } );
                        } else {
                            reviseInputVal.push( _convertPropValToString( propVal, vmProp.type ) );
                        }
                        reviseInputs[ vmProp.propertyName ] = reviseInputVal;
                    }
                }
            } );
            if( dataSource.getDeclViewModel().customPanelInfo ) {
                _.forEach( dataSource.getDeclViewModel().customPanelInfo, function( customPanelVMData ) {
                    let oriVMData = customPanelVMData._internal.origDeclViewModelJson.data;
                    _.forEach( customPanelVMData, function( propVal, propName ) {
                        if( _.has( oriVMData, propName ) ) {
                            reviseInputs[ propName ] = [];
                            if( _.isArray( propVal.dbValue ) ) {
                                _.forEach( propVal.dbValue, function( val ) {
                                    reviseInputs[ propName ].push( _convertPropValToString( val, propVal.type ) );
                                } );
                            } else {
                                reviseInputs[ propName ].push( _convertPropValToString( propVal.dbValue, propVal.type ) );
                            }
                        }
                    } );
                } );
            }
        }
    }

    return [ {
        targetObject: selectedObjectIn,
        reviseInputs: reviseInputs,
        deepCopyDatas: deepCopyDataArr
    } ];
};

export let setActiveView = function( data ) {
    return data.selectedTab.panelId;
};

export let loadPanelTabs = function( customVisibleTabs, panelContext, reviseTitle, newTitle ) {
    let visibleTabs = [];
    if( customVisibleTabs ) {
        visibleTabs = customVisibleTabs;
    } else {
        let reviseTab = {
            tabKey: 'SaveAsRevision',
            pageId: 'SaveAsRevision',
            view: 'SaveAsRevision',
            name: reviseTitle,
            recreatePanel: true,
            priority: 0
        };

        let newTab = {
            tabKey: 'SaveAsNew',
            pageId: 'SaveAsNew',
            view: 'SaveAsNew',
            name: newTitle,
            recreatePanel: true,
            priority: 0
        };

        if( panelContext ) {
            if( panelContext.ReviseHidden !== 'true' ) {
                visibleTabs.push( reviseTab );
            }

            if( panelContext.SaveAsHidden !== 'true' ) {
                visibleTabs.push( newTab );
            }
        }
    }

    const tabChangeCallback = ( pageId, tabTitle ) => {
        eventBus.publish( 'saveAsObject.tabChange', {
            pageId: pageId,
            tabTitle: tabTitle
        } );
    };
    return {
        visibleTabs: visibleTabs,
        api: tabChangeCallback
    };
};

export let handleTabChange = function( visibleTabs, pageId, tabTitle ) {
    let selectedTab = visibleTabs.filter( function( tab ) {
        return tab.pageId === pageId || tab.name === tabTitle;
    } )[ 0 ];
    return {
        activeTab: selectedTab
    };
};


/**
 * Populates the display value from the object
 *
 * @param {String} uid - The uid for fetching model object
 * @param {Object} revisionOf object
 * @return {Object} returns object with revisionOf
 */
export const assignPropertyValue = function( uid, revisionOf, mo, contextMo ) {
    const updatedRevisionOf = { ...revisionOf };
    let objectMo = mo || cdm.getObject( uid );
    if( !objectMo.uid ) {
        objectMo = contextMo;
    }

    updatedRevisionOf.dbValue = objectMo?.props?.object_string?.dbValues?.[0];
    updatedRevisionOf.uiValue = objectMo?.props?.object_string?.uiValues?.[0];

    return {
        revisionOf: updatedRevisionOf
    };
};

let setIsProjectAssignableConstant = function( newData, getTypeConstInput ) {
    return constantsService.getTypeConstantValues( getTypeConstInput ).then( function( response ) {
        if( response && response.constantValues && response.constantValues.length > 0 ) {
            for( var i = 0; i < response.constantValues.length; i++ ) {
                var responseConstantName = response.constantValues[ i ].key.constantName;
                var responseConstantValue = response.constantValues[ i ].value;
                if( responseConstantValue === 'false' && responseConstantName === 'Fnd0EnableAssignProjects' ) {
                    newData.isEnableAssignProjects = false;
                }
            }
        }
    } );
};

/**
 * This method will populate Project/owning project form in Save/Revise based on selected type recieved
 * Get Type Constant to hide Owning Project and Projects section on the selected Type
 * @param {object} data- The panel's view model object
 */
export let setIsProjectAssignableConstantSaveAS = function( data ) {
    var selectedObj = appCtxSvc.getCtx( 'selected' );
    var newData = _.clone( data );
    var adaptedObjects = adapterSvc.getAdaptedObjectsSync( selectedObj );
    return soaSvc.ensureModelTypesLoaded( [ adaptedObjects[0].type ] ).then( function() {
        //Get create input from constants map
        var creIType = cmm.getType( adaptedObjects[0].type );
        var inputTypeName = creIType.constantsMap.SaveAsInput;
        var getTypeConstInput = [];
        getTypeConstInput.push( {
            typeName: inputTypeName,
            constantName: 'Fnd0EnableAssignProjects'
        } );
        return setIsProjectAssignableConstant( newData, getTypeConstInput ).then( ()=>{
            return newData.isEnableAssignProjects;
        } );
    } );
};

export let setIsProjectAssignableConstantReviseAS = function( data ) {
    var selectedObj = appCtxSvc.getCtx( 'selected' );
    var newData = _.clone( data );
    var adaptedObjects = adapterSvc.getAdaptedObjectsSync( selectedObj );
    return soaSvc.ensureModelTypesLoaded( [ adaptedObjects[0].type ] ).then( function() {
        //Get create input from constants map
        var creIType = cmm.getType( adaptedObjects[0].type );
        var inputTypeName = creIType.constantsMap.ReviseInput;
        var getTypeConstInput = [];
        getTypeConstInput.push( {
            typeName: inputTypeName,
            constantName: 'Fnd0EnableAssignProjects'
        } );
        return setIsProjectAssignableConstant( newData, getTypeConstInput ).then( ()=>{
            return newData.isEnableAssignProjects;
        } );
    } );
};


const getModifiedObject = ( baseSelection, activeSelection, createdRevisedObject, parentSelected ) => {
    // Case 1:
    // If parent selection is a folder, then revise is either triggered from PWA or Contents section in SWA,
    // and we need to refresh the PWA as well, so relatedModified object needs to be a folder
    if( parentSelected?.modelType.typeHierarchyArray.indexOf( 'Folder' ) > -1 ) {
        if ( parentSelected.alternateID ) {
            return parentSelected;
        }
        if( activeSelection?.alternateID ) {
            const alternateID = activeSelection.alternateID.split( ',' );
            if( alternateID.length > 1 ) {
                parentSelected.alternateID = alternateID.slice( 1, alternateID.length ).join();
                return parentSelected;
            }
        }
        // non tree case
        return parentSelected;
    }

    // Case 2:
    // If revise is triggered from SWA, parent selection may be an item
    // If the new revision object and the parent ( PWA ) object aren't revisions of the same item,
    // the parent item will be the relatedModified object, and there's no need to refresh PWA.
    const parentSelectionItemUID = parentSelected?.props?.items_tag?.dbValues[0];
    const createdRevisionItemUID = createdRevisedObject?.props?.items_tag?.dbValues[0];
    if( parentSelectionItemUID && createdRevisionItemUID && parentSelectionItemUID !== createdRevisionItemUID ) {
        return parentSelected;
    }

    // Case 3:
    // For revisions triggered through SWA (e.g., History Tab), the parent selection will be the old revision.
    // To refresh the tree, relatedModified needs to be a folder with the corresponding alternateID.
    if( parentSelected?.alternateID ) {
        const alternateID =  parentSelected.alternateID.split( ',' );
        // get parent (folder) object
        let relatedModifiedObject = cdm.getObject( alternateID[1] );
        relatedModifiedObject.alternateID = alternateID.slice( 1, alternateID.length ).join();
        return relatedModifiedObject;
    }

    // Default
    // If none of the above cases apply, return baseSelection or parentSelected.
    return baseSelection || parentSelected;
};

export const updateCdmModified = function( baseSelection, selected, createdObject, pselected ) {
    const relatedModifiedObject = getModifiedObject( baseSelection, selected, createdObject, pselected );

    const pwaSelectionInfo = appCtxSvc.getCtx( 'pwaSelectionInfo' );
    if( pselected.modelType.typeHierarchyArray.indexOf( 'Folder' ) > -1
        // folder is PWA selection
        && ( pselected.selected || pwaSelectionInfo?.currentSelectedCount === 0 ) ) {
        eventBus.publish( 'cdm.relatedModified', {
            relatedModified: [ relatedModifiedObject ],
            createdObjects: [ createdObject ],
            // Special flag for the case when triggering revise from the 'Contents' section of a folder
            // We want to keep the folder selected and not select the new revision object in PWA
            skipSelectingNewObjects: true
        } );
        return;
    }
    eventBus.publish( 'cdm.relatedModified', {
        relatedModified: [ relatedModifiedObject ],
        createdObjects: [ createdObject ]
    } );
};

export default exports = {
    updateSaveAsContextAndActivateCommandPanel,
    saveAsComplete,
    getSaveAsInput,
    getSaveAsInputForAddCopy,
    getReviseInputs,
    getReviseInputs2,
    updateEditStateInURL,
    setActiveView,
    getNewCreatedObject,
    getNewCreatedObjectForAddCopy,
    getRevToSelectForAddCopy,
    loadPanelTabs,
    handleTabChange,
    assignPropertyValue,
    setIsProjectAssignableConstantSaveAS,
    setIsProjectAssignableConstantReviseAS,
    updateCdmModified
};
