// Copyright (c) 2022 Siemens
/* eslint-disable complexity */
/* eslint-disable sonarjs/cognitive-complexity */

/**
 * @module js/Awp0CreateOrUpdateTaskHandlers
 */

import _appCtxSvc from 'js/appCtxService';
import _uwPropertySvc from 'js/uwPropertyService';
import _tcViewModelObjectService from 'js/tcViewModelObjectService';
import _cdm from 'soa/kernel/clientDataModel';
import _workflowUtils from 'js/Awp0WorkflowDesignerUtils';
import _listBoxSvc from 'js/listBoxService';
import _soaSvc from 'soa/kernel/soaService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import msgsvc from 'js/messagingService';

var exports = {};

/**
   * Add handler argument row
   * @param {Object} rowId Row id that will be specific for each handler argument row
   * @param {String} argumentName Argument name value that need to be populated
   * @param {String} argumentValue Argument value that need to be popilated
   * @param {Object} data Data view model object
   * @param {boolean} isEditable True/False based on property need to be editable or not.
   * @return {object} vmObject - this vmObject will get added to selectedHandlerArguments state
   */
var _addHandlerArgumentRowVMOObject = function( rowId, argumentName, argumentValue, data, isEditable ) {
    var vmObject = _tcViewModelObjectService.createViewModelObjectById( argumentName );
    vmObject.type = 'HandlerArgument';
    vmObject.id = rowId;

    var columnInfos = [ 'argument_name', 'argument_value' ];
    var hasLov = false;
    // Iterate for all column info variables and populate the properties on VMO object
    _.forEach( columnInfos, function( columnInfo ) {
        var value = argumentName;
        var dbValues = value;
        var displayValues = value;
        if( columnInfo === 'argument_value' ) {
            value = argumentValue;
            hasLov = true;
            isEditable = true;
            dbValues = [ value[ 0 ] ];
            displayValues = [ value[ 0 ] ];
            if( typeof value[ 0 ] !== 'string' ) {
                dbValues = [ value[ 1 ] ];
                displayValues = [ value[ 1 ] ];
            }
            if( value &&  value[0] === undefined ) {
                dbValues = [];
                displayValues = [];
            }
        }

        var vmProp = _uwPropertySvc.createViewModelProperty( columnInfo, data.i18n[ columnInfo ],
            'STRING', dbValues, displayValues );
        if( hasLov ) {
            vmProp.hasLov = true;
            vmProp.dataProvider = 'argumentValuelistProvider';
            vmProp.getViewModel = function() {
                return data;
            };
        }

        vmProp.propertyDescriptor = {
            displayName: data.i18n[ columnInfo ]
        };

        vmProp.isEditable = isEditable;

        vmObject.props[ columnInfo ] = vmProp;
    } );
    return vmObject;
};

/**
   * Add Empty handler argument row
   * @param {String} argumentName Argument name value that need to be populated
   * @param {String} argumentValue Argument value that need to be popilated
   * @param {Object} data Data view model object
   * @param {boolean} isEditable True/False based on property need to be editable or not.
   * @return {object} vmObject
   */
var _addHandlerArgumentEmptyRowVMO = function( argumentName, argumentValue, data, isEditable ) {
    var vmObject = _tcViewModelObjectService.createViewModelObjectById( 'AAAAAAA' );
    vmObject.type = 'HandlerArgument';
    vmObject.id = 'AAAAAAA';
    vmObject.newRow = true;

    var columnInfos = [ 'argument_name', 'argument_value' ];
    var hasLov = true;
    _.forEach( columnInfos, function( columnInfo ) {
        var value = argumentName;
        if( columnInfo === 'argument_value' ) {
            value = argumentValue;
        }
        var dbValues = value;
        var displayValues = value;
        if( data.optionalArgumentNames.length === 0 || data.isUndefinedArgCommandCase !== undefined ) {
            hasLov = false;
        }

        var vmProp = _uwPropertySvc.createViewModelProperty( columnInfo, 'data.i18n[ columnInfo ]',
            'STRING', dbValues, displayValues );
        if( hasLov ) {
            vmProp.hasLov = true;
            if( columnInfo === 'argument_value' ) {
                vmProp.dataProvider = 'argumentValuelistProvider';
            } else {
                vmProp.dataProvider = 'argumentNamelistProvider';
            }
            vmProp.getViewModel = function() {
                return data;
            };
        }

        vmProp.propertyDescriptor = {
            displayName: 'data.i18n[ columnInfo ]'
        };
        vmProp.isEditable = isEditable;
        vmObject.props[ columnInfo ] = vmProp;
    } );
    return vmObject;
};

/**
   * Populate the actionor rule handler LOV
   * @param {Object} data Data view model object
   * @param {Array} actionHandlerValues Action handler values that need to be shown
   * @param {Array} ruleHandlerValues Rule handler values that need to be shown
   */
var _populateHandlersLOV = function( data, actionHandlerValues, ruleHandlerValues ) {
    // Populate the actions handlers that need to be shown on rule handler LOV
    var actionHandlers = [ '' ];
    actionHandlers = actionHandlers.concat( actionHandlerValues );
    data.actionHandlerValues = _listBoxSvc.createListModelObjectsFromStrings( actionHandlers );

    // Populate the rule handlers that need to be shown on rule handler LOV
    var ruleHandlers = [ '' ];
    ruleHandlers = ruleHandlers.concat( ruleHandlerValues );
    data.ruleHandlerValues = _listBoxSvc.createListModelObjectsFromStrings( ruleHandlers );
};

/**
   * Populate the action or rule handler LOV
   * @param {Object} data Data view model object
   * @param {Array} actionHandlers Action handler values that need to be shown
   * @param {Array} ruleHandlers Rule handler values that need to be shown
   *@return {Array} actionHandlerValues and ruleHandlerValues
   */
export let populateHandlersLOV = function( actionHandlers, ruleHandlers ) {
    // Populate the actions handlers that need to be shown on rule handler LOV
    var emptyActionHandlers = [ '' ];
    actionHandlers = emptyActionHandlers.concat( actionHandlers );
    let actionHandlerValues = _listBoxSvc.createListModelObjectsFromStrings( actionHandlers );

    // Populate the rule handlers that need to be shown on rule handler LOV
    var emptyRuleHandlers = [ '' ];
    ruleHandlers = emptyRuleHandlers.concat( ruleHandlers );
    let ruleHandlerValues = _listBoxSvc.createListModelObjectsFromStrings( ruleHandlers );
    return {
        actionHandlerValues: actionHandlerValues,
        ruleHandlerValues: ruleHandlerValues
    };
};

/**
   * Populate arguments for selected EPMHandler only
   * @param {Object} data Data view model object
   * @param {Object} ctx -ctx
   * @param {Array} selectedHandler - selectedHandler( EPMHandler Heirarachy only )
   *@return {Object} -
   */
export let populateArgumentsTableForSelectedHandler = function( data, ctx, selectedHandler ) {
    // Get all argument values based on dbValues all values to get the whole single argument value
    var argumentValues = _workflowUtils.parseHandlerArguments( selectedHandler.props.arguments.dbValues );
    var vmObjects = [];
    var rowNumber = 0;
    var object = null;
    var isPanelEditable = _workflowUtils.isTemplateEditMode( ctx.xrtSummaryContextObject, ctx );
    let actionHandler = { ...data.actionHandler };
    let ruleHandler = { ...data.ruleHandler };
    if( selectedHandler && selectedHandler.props.object_string ) {
        actionHandler.dbValue = selectedHandler.props.object_string.dbValues[ 0 ];
        actionHandler.uiValue = selectedHandler.props.object_string.uiValues[ 0 ];

        ruleHandler.dbValue = selectedHandler.props.object_string.dbValues[ 0 ];
        ruleHandler.uiValue = selectedHandler.props.object_string.uiValues[ 0 ];
    }
    // list of all arguments (atomic data) for re-redering  Awp0ArgumentsNewValueViewcomponent
    const selectedHandlerArguments = { ...data.selectedHandlerArguments };
    _.forOwn( argumentValues, function( argumentValue, argumentName ) {
        // Check if argument value is null or empty string then that means this argumetn name
        // will not have any value. So we can use empty array as there are no value
        if( argumentValue === null || _.isEmpty( argumentValue ) ) {
            object = _addHandlerArgumentRowVMOObject( rowNumber, [ argumentName ], [], data, false );
        } else {
            object = _addHandlerArgumentRowVMOObject( rowNumber, [ argumentName ], [ argumentValue ], data, false );
        }
        ++rowNumber;
        vmObjects.push( object );
    } );
    //If Handler was already created without any mandatory arguments from RAC, then add that mandatory argument directly to the list
    for( var i in selectedHandlerArguments.arguments ) {
        var index = vmObjects.findIndex( function( vmObject ) {
            return vmObject.uid[0] === selectedHandlerArguments.arguments[i].uid[0];
        } );
        if( index === -1 ) {
            vmObjects.push( selectedHandlerArguments.arguments[i] );
        }
    }
    vmObjects.reverse();
    if( vmObjects.length > 0 ) {
        for( var i = 0; i < vmObjects.length; i++ ) {
            //if selected handlers already has any mandatory arguments.
            if( data.allMandatoryArgumentsMap && data.allMandatoryArgumentsMap[ vmObjects[ i ].props.argument_name.displayValues[ 0 ] ] ) {
                var values = data.allMandatoryArgumentsMap[ vmObjects[ i ].props.argument_name.displayValues[ 0 ] ];
                vmObjects[ i ].isMandatoryArgument = true;
                //if predfined values for an argument has multiselect
                if( values.length > 0 && values[ 0 ].multiselect ) {
                    vmObjects[ i ].props.argument_value.renderingHint = 'checkboxoptionlov';
                    _uwPropertySvc.setHasLov( vmObjects[ i ].props.argument_value, true );
                    _uwPropertySvc.setIsArray( vmObjects[ i ].props.argument_value, true );
                }
            }
        }
    }
    // Set the argument values correctly on data
    data.searchResults = vmObjects;
    data.totalFound = vmObjects.length;
    //updating selectedHandlerArguments for re-rendering the Awp0ArgumentsNewValueViewcomponent
    selectedHandlerArguments.arguments = vmObjects;
    return {
        selectedHandlerArguments: selectedHandlerArguments,
        actionHandler: actionHandler,
        ruleHandler: ruleHandler,
        isPanelEditable: isPanelEditable
    };
};

/**
   * To populate the UI for create action or rule based on selection from
   * handler tree.
   * @param {Object} incontextData Data of current view model
   * @param {Object} selection Selected handler for values needs to be populated
   * @param {boolean} isEditable True/False based on property need to be editable or not.
   */
var _populateCreateHandlerPanelProperties = function( incontextData, selection, isEditable ) {
    let data = { ...incontextData };
    // Check if rule_quorum value present then only set the quorum value
    if( selection && selection.props.rule_quorum && selection.props.rule_quorum.dbValues[ 0 ] === '-1' ) {
        //set the total no. to the rule quorum if encounterd '-1'
        data.ruleQuorumValue.dbValue = selection.props.rule_handlers.dbValues.length;
        data.ruleQuorumValue.uiValue = selection.props.rule_handlers.dbValues.length;
        data.ruleQuorumValue.valueUpdated = false;
    } else if( selection && selection.props.rule_quorum && selection.props.rule_quorum.dbValues[ 0 ] !== '-1' ) {
        //set the existing rule quorum
        data.ruleQuorumValue.dbValue = selection.props.rule_quorum.dbValues[ 0 ];
        data.ruleQuorumValue.uiValue = selection.props.rule_quorum.uiValues[ 0 ];
        data.ruleQuorumValue.valueUpdated = false;
    }
    // Check if action and rule handlers are already loaded then
    // no need to make SOA call again
    if( data.actionHandlers && data.ruleHandlers ) {
        // Populate action and rule handlers
        _populateHandlersLOV( data, data.actionHandlers, data.ruleHandlers );
    }
    // Set all properties for create handler case to be editable or not
    data.handlerType.isEditable = isEditable;
    data.handlerType.isEnabled = isEditable;
    data.ruleQuorumValue.isEditable = isEditable;
    data.ruleQuorumValue.isEnabled = isEditable;
    data.ruleHandlersLOV.isEditable = isEditable;
    data.ruleHandlersLOV.isEnabled = isEditable;
    data.ruleHandlersLOV.dbValue = '';
    data.ruleHandlersLOV.uiValue = '';
    // Set the value updated to false so that when user add rule handler
    // that time LOV should not be shown as dirty
    data.ruleHandlersLOV.valueUpdated = false;
    data.actionHandlersLOV.isEditable = isEditable;
    data.actionHandlersLOV.isEnabled = isEditable;
    data.actionHandlersLOV.dbValue = '';
    data.actionHandlersLOV.uiValue = '';
    // Set the value updated to false so that when user add action handler
    // that time LOV should not be shown as dirty
    data.actionHandlersLOV.valueUpdated = false;
    data.actionHandler.dbValue = '';
    data.actionHandler.uiValue = '';
    data.ruleHandler.dbValue = '';
    data.ruleHandler.uiValue = '';
    var selectedHandlerArguments = {
        arguments: []
    };
    return {
        handlerType: data.handlerType,
        ruleQuorumValue: data.ruleQuorumValue,
        ruleHandlersLOV: data.ruleHandlersLOV,
        actionHandlersLOV: data.actionHandlersLOV,
        actionHandlerValues: data.actionHandlerValues,
        ruleHandlerValues: data.ruleHandlerValues,
        isPanelEditable: isEditable,
        handlerData: data.handlerData,
        actionHandler: data.actionHandler,
        ruleHandler: data.ruleHandler,
        selectedHandlerArguments: selectedHandlerArguments
    };
};

/**
   * Populate the handler panel properties that need to be shown on UI. Only called when Trigger or Rule is selected
   * @param {Object} incontextData Data view model object
   * @param {Object} selection - selected action type or Rule
   * @param{Object} ctx -ctx
   * @return {Object} all the necesarry widgets with editable options and data for them
   */
export let populateHandlerPanelData = function( incontextData, selection, ctx ) {
    if( !selection ) {
        return null;
    }
    const data = { ...incontextData };

    // Check if selected obejct is not null then only get the model object
    // and try to find the argument values
    var selectedObject = _cdm.getObject( selection.uid );
    // Check if selected object is null then use existing object as selected object
    if( !selectedObject ) {
        selectedObject = selection;
    }

    var isPanelEditable = _workflowUtils.isTemplateEditMode( ctx.xrtSummaryContextObject, ctx );
    data.isPanelEditable = isPanelEditable;
    return _populateCreateHandlerPanelProperties( data, selectedObject, isPanelEditable );
};

/**
   * Add empty row to selectedHandlerArguments
   * @param {Object} selectedHandlerArguments  atomic data map for all the arguments object
   * @param {Object} data - data
   */
export let addHandlerArgumentRow = function( selectedHandlerArguments, data ) {
    var argumentName = '';
    var argumentValue = '';
    var lastArgumentIndex = selectedHandlerArguments.arguments.length - 1;
    // Add new handler argument row and update the selectedHandlerArguments state
    var vmObject = _addHandlerArgumentEmptyRowVMO( argumentName, argumentValue, data, true );
    vmObject.isReadOnly = false;
    vmObject.isUndefinedArgRow = false;
    const selectedHandlerArguments1 = { ...selectedHandlerArguments };
    //checking if last row has isReadOnly variable true or not, if not that means all the arguments are already present in the selected handler.
    // This check is only for the argumnets which get created through add argument command
    if( lastArgumentIndex > -1 && selectedHandlerArguments1.arguments[ lastArgumentIndex ].isReadOnly === false && selectedHandlerArguments1.arguments[ lastArgumentIndex ].props.argument_name.dbValue !== '' ) {
        var object = _.clone( selectedHandlerArguments1.arguments[ lastArgumentIndex ] );
        //adding variable to disable the editing of Argument names when we click on Add argument command. So that User cannot go back and change the argument name again
        object.isReadOnly = true;
        selectedHandlerArguments1.arguments[ lastArgumentIndex ] = object;
    }
    selectedHandlerArguments1.arguments.push( vmObject );
    selectedHandlerArguments.update( selectedHandlerArguments1 );
};

/**
   * Add empty row to selectedHandlerArguments
   * @param {Object} selectedHandlerArguments  atomic data map for all the arguments object
   * @param {Object} data - data
   */
export let addUndefinedHandlerArgumentRow = function( selectedHandlerArguments, data ) {
    var argumentName = '';
    var argumentValue = '';
    data.isUndefinedArgCommandCase = true;
    // Add new handler argument row and update the selectedHandlerArguments state
    var vmObject = _addHandlerArgumentEmptyRowVMO( argumentName, argumentValue, data, true );
    vmObject.isReadOnly = false;
    vmObject.isUndefinedArgRow = true;
    const selectedHandlerArguments1 = { ...selectedHandlerArguments };
    selectedHandlerArguments1.arguments.push( vmObject );
    selectedHandlerArguments.update( selectedHandlerArguments1 );
};

/**
   * Addditional dataMap Input for SOA
   * @param {Object} data - data
   * @return (Object) inputMap
   */
var _getHandlerArgumentsadditionalDataMap = function( data ) {
    var inputMap = {};
    for ( var i in data.selectedHandlerArguments.arguments ) {
        if( data.selectedHandlerArguments.arguments[i].props.argument_name.dbValue[0] ) {
            inputMap[data.selectedHandlerArguments.arguments[i].props.argument_name.dbValue[0]] = data.selectedHandlerArguments.arguments[i].props.argument_value.dbValue;
        }
    }
    return inputMap;
};

var throwInvalidMessage = function( data, additionalDataMap ) {
    var invalidArguments = '';
    var selectedArgumentNames = [];
    var commonArguments = [];
    //var hintMessage = '';
    _.forOwn( additionalDataMap, function( argumentValue, argumentName ) {
        selectedArgumentNames.push( argumentName );
        var isNullable = data.handlerData.nullable.indexOf( argumentName );
        //check if argument value is not nullable
        // argumentValue.length > 0  check is for null value argument, it has undefined value which does gets trim()
        if( argumentValue.length > 0 && isNullable === -1 ) {
            if( _.isEmpty( argumentValue[ 0 ] ) || _.isEmpty( argumentValue[ 0 ].trim() ) ) {
                invalidArguments = invalidArguments + argumentName + ',';
            }
        }
    } );
    if( data.handlerData && data.handlerData.required_one_of ) {
        for( var j = 0; j < data.handlerData.required_one_of.length; j++ ) {
            var requiredOneOf = Object.keys( data.handlerData.required_one_of[ j ] );
            //checking if available arguments has any of the requiredOneOf present or not
            commonArguments = requiredOneOf.filter( x => selectedArgumentNames.indexOf( x ) !== -1 );
            if( commonArguments && commonArguments.length === 0 ) {
                msgsvc.showError( data.hint.dbValues[ j ] );
                return true;
            }
        }
    }
    if( invalidArguments !== '' ) {
        var message = msgsvc.applyMessageParams( data.i18n.invalidValue, [ '{{argumentName}}' ], {
            argumentName: invalidArguments
        } );
        msgsvc.showError( message );
        return true;
    }
    if( selectedArgumentNames.indexOf( '-target_task' ) !== -1 && selectedArgumentNames.indexOf( '-to_attach' ) !== -1 ) {
        var toAttachValue = additionalDataMap['-to_attach'];
        if( toAttachValue[0] !== 'task' ) {
            var message = msgsvc.applyMessageParams( data.i18n.incorrectConfiguration );
            msgsvc.showError( message );
            return true;
        }
    }
    return false;
};

var _getUpdateHandlerSOAInput = function( data, inputData, selectedObject ) {
    var additionalDataMap = _getHandlerArgumentsadditionalDataMap( data );
    var invalidInput = throwInvalidMessage( data, additionalDataMap );
    if( invalidInput ) {
        return;
    }
    var object = {
        clientID: 'updateHandler',
        handlerToUpdate: selectedObject.uid,
        additionalData: additionalDataMap
    };
    inputData.push( object );
};

var _getUpdateRuleHandlerSOAInput = function( data, inputData, selectedObject ) {
    //var selectedObject = data.vmo;
    if( data.ruleQuorumValue.dbValue === 'All' ) {
        data.ruleQuorumValue.dbValue = -1;
        data.ruleQuorumValue.uiValue = -1;
    }
    var ruleQuorum = parseInt( data.ruleQuorumValue.dbValue );
    var handlerName = data.ruleHandlersLOV.dbValue;
    var additionalDataMap = _getHandlerArgumentsadditionalDataMap( data );
    var invalidInput = throwInvalidMessage( data, additionalDataMap );
    if( invalidInput ) {
        return;
    }
    var taskTemplateUid = _appCtxSvc.ctx.selected.uid;
    var object = {
        clientID: 'updateBusinessRuleHandler',
        businessRule: selectedObject.uid,
        ruleQuorum: ruleQuorum,
        taskTemplate: taskTemplateUid,
        additionalData: additionalDataMap
    };
    if( handlerName ) {
        object.handlerName = handlerName;
    }
    inputData.push( object );
};
var _getCreateHandlerSOAInput = function( data, inputData, selectedObject ) {
    var handlerType = 'Action';
    var action = selectedObject.actionType;
    var handlerName = data.actionHandlersLOV.dbValue;
    var taskTemplateUid = _appCtxSvc.ctx.selected.uid;
    if( !data.handlerType.dbValue ) {
        handlerType = 'Rule';
        handlerName = data.ruleHandlersLOV.dbValue;
    }
    var additionalDataMap = _getHandlerArgumentsadditionalDataMap( data );
    var invalidInput = throwInvalidMessage( data, additionalDataMap );
    if( invalidInput ) {
        return;
    }
    var object = {
        clientID: 'createHandler',
        handlerName: handlerName,
        taskTemplate: taskTemplateUid,
        handlerType: handlerType,
        action: action,
        additionalData: additionalDataMap
    };
    if( handlerName && handlerName !== '' ) {
        inputData.push( object );
    }
};

/**
   *  Update the template properties
   * @param {Object} data - data
   * @param {Object} ctx - ctx
   * @param {Object} props - props
   */
export let createOrUpdateHandler = function( data, ctx, props ) {
    var selectedObject = props.subPanelContext.selectedActionOrHandlerObject;
    var inputData = [];
    if( selectedObject && selectedObject.modelType && selectedObject.modelType.typeHierarchyArray.indexOf( 'EPMHandler' ) > -1 ) {
        _getUpdateHandlerSOAInput( data, inputData, selectedObject );
    } else if( selectedObject && selectedObject.modelType && selectedObject.modelType.typeHierarchyArray.indexOf( 'EPMBusinessRule' ) > -1 ) {
        _getUpdateRuleHandlerSOAInput( data, inputData, selectedObject );
    } else if( selectedObject && !selectedObject.modelType ) {
        _getCreateHandlerSOAInput( data, inputData, selectedObject );
    }
    var soaInput = {
        input: inputData
    };

    // Check if SOA input is not null and not empty then only make SOA call
    if( soaInput && soaInput.input && soaInput.input.length > 0 ) {
        _soaSvc.post( 'Workflow-2019-06-Workflow', 'createOrUpdateHandler', soaInput ).then( function( response ) {
            var actionHandler = response.createdorUpdatedObjects[ 0 ].handlerObject;
            var ruleHandler = response.createdorUpdatedObjects[ 0 ].ruleObject;
            var focusObjectUid = '';
            if( ruleHandler && ruleHandler.uid !== 'AAAAAAAAAAAAAA' ) {
                focusObjectUid = ruleHandler.uid;
            } else if( actionHandler && actionHandler.uid !== 'AAAAAAAAAAAAAA' ) {
                focusObjectUid = actionHandler.uid;
            }
            if( response.createdorUpdatedObjects[ '0' ].clientID === 'updateHandler' || response.createdorUpdatedObjects[ '0' ].clientID === 'updateBusinessRuleHandler' ) {
                if( props.subPanelContext.subPanelContext.workflowDgmState.selectedNodes.length > 0 ) {
                    var associatedNode = ctx.graph.graphModel.graphControl.getSelected( 'Node' );
                    var associatedEdge = associatedNode[0].getEdges( 'IN' );
                    for( var i = 0; i < associatedEdge.length; ++i ) {
                        if( associatedEdge[ i ].getLabel() && associatedNode[ 0 ].nodeId === associatedEdge[ i ].targetNode.nodeId && soaInput.input[ 0 ].additionalData[ '-decision' ] ) {
                            ctx.graph.graphModel.graphControl.graph.setLabel( associatedEdge[ i ], soaInput.input[ 0 ].additionalData[ '-decision' ][ 0 ] );
                            break;
                        }
                    }
                }
            }
            // Set the value on app context serivce and activate the command panel
            _appCtxSvc.registerCtx( 'workflowHandlerFocusUid', focusObjectUid );
            //refresh the handlers tree
            eventBus.publish( 'workflowDesigner.updateHandlerTree' );
        },
        function( error ) {
            msgsvc.showError( error.message );
        } );
    }
};
//Populating values list for respective arguments
var createValueList = function( data, values ) {
    if( values && values.length > 0 ) {
        // if values has multiselect and freetext
        if( values[ 0 ].multiselect && values[ 0 ].undefined_and_lov ) {
            data.multiselect = true;
            data.argHasFreeFormText = true;
            let tempValues = _.cloneDeep( values );
            tempValues.splice( 0, 1 );
            data.argumentValueslist = _listBoxSvc.createListModelObjectsFromStrings( tempValues );
            //if values only has multiselect
        } else if( values[ 0 ].multiselect ) {
            data.multiselect = true;
            let tempValues = _.cloneDeep( values );
            tempValues.splice( 0, 1 );
            data.argumentValueslist = createListModelObjectsFromStrings( tempValues );
            //if values has free text and lov
        } else if( values[ 0 ].undefined_and_lov ) {
            data.argHasFreeFormText = true;
            let tempValues = _.cloneDeep( values );
            tempValues.splice( 0, 1 );
            var emptyValue = _listBoxSvc.createListModelObjectsFromStrings( [ '' ] );
            data.argumentValueslist = emptyValue;
            var argumentValueslist = _listBoxSvc.createListModelObjectsFromStrings( tempValues );
            data.argumentValueslist.push.apply( data.argumentValueslist, argumentValueslist );
        } else if( values[ 0 ].clientsort ) {
            let tempValues = _.cloneDeep( values );
            // If client sort is needed then splice the list first and then sort based
            // on ignore case compare and then populate in the list
            tempValues.splice( 0, 1 );
            var sortedTempValues = tempValues.sort( function( a, b ) {
                return a && b && a.toLowerCase().localeCompare( b.toLowerCase() );
            } );
            data.argumentValueslist = _listBoxSvc.createListModelObjectsFromStrings( sortedTempValues );
        } else {
            data.argumentValueslist = _listBoxSvc.createListModelObjectsFromStrings( values );
        }
    }
};

var _getEmptyListModel = function() {
    return {
        propDisplayValue: '',
        propInternalValue: '',
        propDisplayDescription: '',
        hasChildren: false,
        children: {},
        sel: false
    };
};

let createListModelObjectsFromStrings = function( strings ) {
    var listModels = [];

    strings.forEach( function( str ) {
        var listModel = _getEmptyListModel();

        listModel.propDisplayValue = str;
        listModel.propInternalValue = str;

        listModels.push( listModel );
    } );

    return listModels;
};

//Get the curret argument value for each argument when any handler is selected
var _getCurrentArgumentValue = function( data, vmo ) {
    if( data.argumentValueslist.length > 0 ) {
        if( data.multiselect && data.argHasFreeFormText && vmo.props.argument_value.uiValue !== '' ) {
            var allAssigee = [];
            var uiValue = vmo.props.argument_value.uiValue;
            if( _appCtxSvc.ctx.preferences.EPM_ARG_target_user_group_list_separator && _appCtxSvc.ctx.preferences.EPM_ARG_target_user_group_list_separator.length > 0 && _appCtxSvc.ctx.preferences
                .EPM_ARG_target_user_group_list_separator[ 0 ].trim() !== '' ) {
                var value = uiValue.split( _appCtxSvc.ctx.preferences.EPM_ARG_target_user_group_list_separator[ 0 ] );
                allAssigee = value;
            } else {
                uiValue = uiValue.replace( '\\,', '\\|' );
                var dbValue = uiValue.split( ',' );
                _.forEach( dbValue, function( assignee ) {
                    // Replace it back to original value
                    var finalValue = assignee.replace( '\\|', '\\,' );
                    var index = _.findKey( data.argumentValueslist, {
                        propDisplayValue: finalValue
                    } );
                    //checking if value is added through freeform text, then add it to the list
                    if( !index || index <= -1 ) {
                        var temp = {
                            propDisplayValue: finalValue,
                            propInternalValue: finalValue
                        };
                        data.argumentValueslist.push( temp );
                    }
                    allAssigee.push( finalValue );
                } );
            }
            data.argumentValuesMultiselect.dbValue = allAssigee;
            data.argumentValuesMultiselect.uiValue = vmo.props.argument_value.uiValue;
            data.argumentValuesMultiselect.displayValues = [ ...allAssigee ];
            data.argumentValuesMultiselect.valueUpdated = false;
        } else if( data.multiselect && vmo.props.argument_value.uiValue !== '' ) {
            var multiselectdbValue = vmo.props.argument_value.uiValue.split( ',' );
            data.argumentValuesMultiselect.dbValue = multiselectdbValue;
            data.argumentValuesMultiselect.uiValue = vmo.props.argument_value.uiValue;
            data.argumentValuesMultiselect.displayValues = [ ...multiselectdbValue ];
            data.argumentValuesMultiselect.valueUpdated = false;
        } else {
            var index = _.findKey( data.argumentValueslist, function( obj ) {
                return obj.propDisplayValue.toLowerCase() === vmo.props.argument_value.uiValue.toLowerCase();
            } );
            if( index ) {
                data.argumentValues.dbValue = data.argumentValueslist[ index ].propInternalValue;
                data.argumentValues.uiValue = data.argumentValueslist[ index ].propDisplayValue;
                data.argumentValues.valueUpdated = false;
            } else if( !index && data.argHasFreeFormText && vmo.props.argument_value.uiValue !== '' ) {
                data.argumentValueTextBox.dbValue = vmo.props.argument_value.uiValue;
                data.argumentValueTextBox.uiValue = vmo.props.argument_value.uiValue;
                data.argumentValueTextBox.valueUpdated = false;
                //emptying the previous value if any, for undefined and lov case
                data.argumentValues.dbValue = '';
                data.argumentValues.uiValue = '';
                data.argumentValues.valueUpdated = false;
            }else if( data.argumentValueslist.length > 0 ) {
                data.argumentValues.dbValue = data.argumentValueslist[ 0 ].propInternalValue;
                data.argumentValues.uiValue = data.argumentValueslist[ 0 ].propDisplayValue;
            }
        }
    } else if( vmo.props.argument_value.dbValue.length > 0 && vmo.props.argument_value.dbValue[0] !== '' ) {
        //Giving Value for already existing arguments
        data.argumentValueTextBox.dbValue = vmo.props.argument_value.dbValue[0];
        data.argumentValueTextBox.uiValue = vmo.props.argument_value.dbValue[0];
        data.argumentValueTextBox.valueUpdated = false;
        data.argHasFreeFormText = true;
    }
};

export let clearArgumentValueTextBoxAction = function( data, selectedArgument ) {
    if ( data.argumentValueTextBox !== undefined && ( selectedArgument === true ||
        selectedArgument.props?.argument_value?.dbValue?.[0] === data.argumentValueTextBox.dbValue ) ) {
        data.argumentValueTextBox.dbValue = '';
        data.argumentValueTextBox.uiValue = '';
    }
};

/**
   *  Populate values for the respective arguments and show it to the widgets
   * @param {Object} incontextData - current data
   * @param {Object} handlerRelatedData - data of handlers tree table
   * @param {Object} vmo -current vmo of selectedHandlerArguments
   * @param {Object} argumentToValueMap - argumentToValueMap
   * @param {Object} ctx - ctx
   * @param {Object} props - props
   * @return {object} all the values widgets and value list for respective argument
   */
export let populateArgumentValueslist = function( incontextData, handlerRelatedData, vmo, argumentToValueMap, ctx, props ) {
    const data = { ...incontextData };
    data.argumentValueslist = [];
    data.multiselect = false;
    data.argHasFreeFormText = false;
    data.argHasNullValue = false;
    data.argumentValues.isEditable = handlerRelatedData.isPanelEditable;

    data.argumentValueTextBox.isEditable = handlerRelatedData.isPanelEditable;
    data.argumentValuesMultiselect.isEditable = handlerRelatedData.isPanelEditable;
    data.argumentNames.dbValue = vmo.props.argument_name.dbValue;
    data.argumentNames.uiValue = vmo.props.argument_name.dbValue;

    var values = [];
    //check if new argument row has null value
    if( handlerRelatedData.handlerData && handlerRelatedData.handlerData.nullvalue && vmo && vmo.newRow ) {
        var index = handlerRelatedData.handlerData.nullvalue.indexOf( vmo.props.argument_name.dbValue[0] );
        if( index > -1 ) {
            data.argHasNullValue = true;
        }
    }
    if( vmo.isReadOnly && !_.isEmpty( vmo.props.argument_name.dbValue[0] ) ) {
        let valuesOfSelectedArgument = handlerRelatedData.allOptionalArgumentsMap[vmo.props.argument_name.dbValue[0]];
        if( !data.argHasNullValue && data.argumentValues.uiValue === '' && data.argumentValuesMultiselect.uiValue === '' && ( _.isEmpty( data.argumentValueTextBox.uiValue ) || _.isEmpty( data
            .argumentValueTextBox.uiValue.trim() ) ) ) {
            var isNullable = handlerRelatedData.handlerData.nullable.indexOf( vmo.props.argument_name.dbValue[0] );
            //check if argument value is not nullable. Second check is if argument selected has predefind LOV values.It will get selected by default later so no need to show error
            if( isNullable === -1 && valuesOfSelectedArgument.length === 0 ) {
                var message = msgsvc.applyMessageParams( data.i18n.invalidValue, [ '{{argumentName}}' ], {
                    argumentName: data.argumentNames.dbValue
                } );
                msgsvc.showError( message );
            }
        }
    }
    // check if selected handler has any argument which has null value
    if( handlerRelatedData.handlerData && handlerRelatedData.handlerData.nullvalue && vmo ) {
        var selectedIndex = handlerRelatedData.handlerData.nullvalue.indexOf( vmo.props.argument_name.uiValue );
        if( selectedIndex > -1 ) {
            data.readOnlyArgumentName.dbValue = vmo.props.argument_name.dbValue;
            data.readOnlyArgumentName.uiValue = vmo.props.argument_name.uiValue;
            data.argHasNullValue = true;
            return {
                argHasNullValue: true,
                readOnlyArgumentName: data.readOnlyArgumentName
            };
        }
    }
    if( vmo && vmo.isMandatoryArgument ) {
        data.readOnlyArgumentName.dbValue = vmo.props.argument_name.dbValue;
        data.readOnlyArgumentName.uiValue = vmo.props.argument_name.uiValue;
        if( handlerRelatedData.allMandatoryArgumentsMap && handlerRelatedData.allMandatoryArgumentsMap[ vmo.props.argument_name.dbValue[ 0 ] ] ) {
            values = handlerRelatedData.allMandatoryArgumentsMap[ vmo.props.argument_name.dbValue[ 0 ] ];
            createValueList( data, values );
        }
        _getCurrentArgumentValue( data, vmo );
    } else if( vmo && !vmo.isMandatoryArgument ) {
        data.readOnlyArgumentName.dbValue = vmo.props.argument_name.dbValue;
        data.readOnlyArgumentName.uiValue = vmo.props.argument_name.uiValue;
        if( handlerRelatedData.allOptionalArgumentsMap && handlerRelatedData.allOptionalArgumentsMap[ vmo.props.argument_name.dbValue[ 0 ] ] ) {
            values = handlerRelatedData.allOptionalArgumentsMap[ vmo.props.argument_name.dbValue[ 0 ] ];
            createValueList( data, values );
        }
        _getCurrentArgumentValue( data, vmo );
    } else if( handlerRelatedData.allOptionalArgumentsMap && handlerRelatedData.allOptionalArgumentsMap[ vmo.props.argument_name.dbValue[0] ] ) {
        values = handlerRelatedData.allOptionalArgumentsMap[ vmo.props.argument_name.dbValue[0] ];
        createValueList( data, values );
    }
    exports.updateArgumentValueMap( argumentToValueMap, data, ctx, props, vmo );
    if( !vmo.isMandatoryArgument && props.selectedHandlerArguments.arguments.length === 1 ) {
        //for single optional argument update the map to re-render
        props.selectedHandlerArguments.update( props.selectedHandlerArguments );
    }
    return {
        argumentValueslist: data.argumentValueslist,
        multiselect: data.multiselect,
        argHasFreeFormText: data.argHasFreeFormText,
        argHasNullValue: data.argHasNullValue,
        readOnlyArgumentName: { ...data.readOnlyArgumentName },
        argumentValueTextBox: { ...data.argumentValueTextBox },
        argumentValuesMultiselect: { ...data.argumentValuesMultiselect },
        argumentValues: { ...data.argumentValues },
        argumentNameTextBox: data.argumentNameTextBox,
        argumentNames: data.argumentNames
    };
};
/**
   *  Populate values of the arguments to show at the arguments name widget
   * @param {Object} data - current data
   * @param {Object} handlerRelatedData - data of handlers tree table
   * @param {Object} props - props
   * @return {object} argument names list for argumentNames widget
   */
export let populateArgumentNameslist = function( data, handlerRelatedData, props ) {
    var argumentNameList = _listBoxSvc.createListModelObjectsFromStrings( handlerRelatedData.optionalArgumentNames );
    for( var i = 0; i < props.selectedHandlerArguments.arguments.length; i++ ) {
        if( props.selectedHandlerArguments.arguments[i].props.argument_name.dbValue[0] !== props.subPanelContext.vmo.props.argument_name.dbValue[0] ) {
            var argumentNameMatchedIndex = _.findKey( argumentNameList, {
                propDisplayValue: props.selectedHandlerArguments.arguments[i].props.argument_name.dbValue[0]
            } );
            if( argumentNameMatchedIndex && data.argumentNames.dbValue !== props.selectedHandlerArguments.arguments[i].props.argument_name.dbValue[0] ) {
                argumentNameList.splice( argumentNameMatchedIndex, 1 );
                for( var j = 0; j < handlerRelatedData.handlerData.mutex.length; j++ ) {
                    var mutexArgumentNames = Object.keys( handlerRelatedData.handlerData.mutex[ j ] );
                    for( var k = 0; k < mutexArgumentNames.length; k++ ) {
                        if( mutexArgumentNames[ k ] === props.selectedHandlerArguments.arguments[i].props.argument_name.dbValue[0] ) {
                            _.forEach( mutexArgumentNames, function( mutex ) {
                                var mutexNameMatchedIndex = _.findKey( argumentNameList, {
                                    propDisplayValue: mutex
                                } );
                                if( mutexNameMatchedIndex ) {
                                    argumentNameList.splice( mutexNameMatchedIndex, 1 );
                                }
                            } );
                        }
                    }
                }
            }
        }
    }

    data.argumentNameslist = argumentNameList;
    if( argumentNameList.length === 0 ) {
        data.argumentValues.dbValue = [];
        data.argumentValues.uiValue = '';
    }
    return { argumentNameList: data.argumentNameslist };
};

/**
   *  Populate handler information.
   * @param {Object} data - current data
   * @param { Object } fields - fields data
   * @return {object} all the handler related info
   */
export let populateHandlerInfo = function( data, fields ) {
    const tempData = { ...data };
    let allOptionalArgumentsMap = {};
    let allMandatoryArgumentsMap = {};
    let optionalArgumentNames = [];
    let mandatoryArgumentNames = [];
    let no_arguments = false;
    let undefined_arg_value = false;
    let isAddHandlerArgumentPanelVisible = false;
    let vmObjects = [];

    if( !data.handlerData ) {
        data.handlerData = '';
    }
    if( data.handlerData === '' ) {
        data.hint.dbValues = [];
        data.hint.uiValue = '';
        tempData.selectedHandlerArguments.arguments = [];
        return{
            selectedHandlerArguments: tempData.selectedHandlerArguments,
            hint: data.hint
        };
    }
    data.handlerData = JSON.parse( data.handlerData );
    if( data.handlerData && data.handlerData.no_arguments ) {
        no_arguments = true;
    }
    if( data.handlerData && data.handlerData.undefined_arg_value ) {
        undefined_arg_value = true;
    }
    //checking for mandatory arguments
    if( data.handlerData && data.handlerData.mandatory && data.handlerData.mandatory.length > 0 ) {
        var rowNumber = 1;
        _.forEach( data.handlerData.mandatory, function( argument ) {
            var values = Object.values( argument );
            var argumentValues = values[ 0 ];
            var argumentName = Object.keys( argument );
            var isEditable = false;
            mandatoryArgumentNames.push( argumentName[ 0 ] );
            if( argumentValues.length > 0 && typeof argumentValues[ 0 ] !== 'string' ) { // if on 0th index we get multiselect, undefined_and_lov key
                argumentValues = [];
            } else if( argumentValues.length === 0 ) {
                argumentValues = [ '' ];
            } else {
                argumentValues = [ argumentValues[ 0 ] ];
            }
            allMandatoryArgumentsMap[ argumentName ] = values[ 0 ];
            var vmObject = _addHandlerArgumentRowVMOObject( rowNumber, argumentName, argumentValues, data, isEditable );
            vmObject.isMandatoryArgument = true;
            rowNumber++;
            vmObjects.push( vmObject );
        } );
    }
    //checking for optional arguments
    if( data.handlerData.optional && data.handlerData.optional.length > 0 ) {
        isAddHandlerArgumentPanelVisible = true;
        _.forEach( data.handlerData.optional, function( argument ) {
            var values = Object.values( argument );
            var argumentValues = values[ 0 ];
            var argumentName = Object.keys( argument );
            optionalArgumentNames.push( argumentName[ 0 ] );
            allOptionalArgumentsMap[ argumentName ] = argumentValues;
        } );
    }
    if( data.hint ) {
        data.hint.dbValues = [];
        data.hint.uiValue = '';
        if( data.hint.targetTaskCase === true ) {
            data.hint.targetTaskCase = false;
        }
        if( data.handlerData.required_one_of && data.handlerData.required_one_of.length > 0 ) {
            var hints = [];
            var hintMessage = '';
            for( var j = 0; j < data.handlerData.required_one_of.length; j++ ) {
                var hint = '';
                var requiredOneOf = Object.keys( data.handlerData.required_one_of[ j ] );
                for( var k = 0; k < requiredOneOf.length; k++ ) {
                    if( k === requiredOneOf.length - 1 ) {
                        hint += ' ' + requiredOneOf[ k ];
                    } else {
                        hint += ' ' + requiredOneOf[ k ] + ',';
                    }
                }
                var message = msgsvc.applyMessageParams( data.i18n.hintMessage, [ '{{hint}}' ], {
                    hint: hint
                } );
                hints.push( message );
            }
            for( var i = 0; i < hints.length; i++ ) {
                hintMessage += hints[ i ] + '\n' + '\n';
                data.hint.dbValues.push( hintMessage );
            }
            data.hint.uiValue = hintMessage;
        } else {
            data.hint.dbValues = [];
            data.hint.uiValue = '';
        }
        if( fields && fields.hint ) {
            fields.hint.update( data.hint.dbValues, { uiValue: data.hint.uiValue }, { markModified: true, runValidation: true } );
        }
    }
    tempData.selectedHandlerArguments.arguments = vmObjects;
    return {
        allOptionalArgumentsMap: allOptionalArgumentsMap,
        allMandatoryArgumentsMap: allMandatoryArgumentsMap,
        optionalArgumentNames: optionalArgumentNames,
        mandatoryArgumentNames: mandatoryArgumentNames,
        no_arguments: no_arguments,
        undefined_arg_value: undefined_arg_value,
        handlerData: data.handlerData,
        isAddHandlerArgumentPanelVisible: isAddHandlerArgumentPanelVisible,
        selectedHandlerArguments: tempData.selectedHandlerArguments
    };
};

/**
   *  Update the argument value map whenever any change happened to the argument values widgets
   * @param {Object} argumentToValueMap - argumentToValueMap
   * @param {Object} data - data
   * @param {Object} ctx - ctx
   * @param {Object} props - props
   */
export let updateArgumentValueMap = function( argumentToValueMap, data, ctx, props, vmo  ) {
    let separator = ',';
    if( ctx.preferences.EPM_ARG_target_user_group_list_separator && ctx.preferences.EPM_ARG_target_user_group_list_separator.length > 0 && ctx.preferences.EPM_ARG_target_user_group_list_separator[ 0 ]
        .trim() !== '' ) {
        separator = ctx.preferences.EPM_ARG_target_user_group_list_separator[ 0 ];
    }
    //multiselect and free form text widgets enabled
    if( data.multiselect && data.argumentValueslist.length > 0 && data.argHasFreeFormText ) {
        var combinedValue = data.argumentValuesMultiselect.dbValue.toString();
        if( combinedValue !== '' && data.argumentValueTextBox.uiValue !== '' ) {
            combinedValue = combinedValue + ',' + data.argumentValueTextBox.uiValue;
        } else if( combinedValue === '' && data.argumentValueTextBox.uiValue !== '' ) {
            combinedValue = data.argumentValueTextBox.uiValue;
        }
        combinedValue = combinedValue.replace( '\\,', '\\|' );
        combinedValue = combinedValue.replace( /,/g, separator );
        combinedValue = combinedValue.replace( '\\|', '\\,' );
        if( data.readOnlyArgumentName.uiValue !== '' ) {
            vmo.props.argument_value.dbValue = [ combinedValue ];
            vmo.props.argument_value.uiValue = combinedValue;
        } else if( data.argumentNames.uiValue !== '' ) {
            vmo.uid = [ data.argumentNames.uiValue ];
            vmo.id = data.argumentNames.uiValue;
            vmo.props.argument_value.dbValue = [ combinedValue ];
            vmo.props.argument_value.uiValue = combinedValue;
        }
        // if free form and LOV widgets are enabled
    } else if( !data.multiselect && data.argumentValueslist.length > 0 && data.argHasFreeFormText ) {
        if( data.argumentValueTextBox.uiValue !== '' ) {
            data.argumentValueTextBox.uiValue = data.argumentValueTextBox.uiValue.replace( '\\,', '\\|' );
            data.argumentValueTextBox.uiValue = data.argumentValueTextBox.uiValue.replace( /,/g, separator );
            data.argumentValueTextBox.uiValue = data.argumentValueTextBox.uiValue.replace( '\\|', '\\,' );
            //if predifined argument present in selected handler
            if( data.readOnlyArgumentName.uiValue !== '' ) {
                vmo.props.argument_value.dbValue = [ data.argumentValueTextBox.uiValue ];
                //if empty row added with add arguments command click
            } else if( data.argumentNames.uiValue !== '' ) {
                vmo.uid = [ data.argumentNames.uiValue ];
                vmo.id = data.argumentNames.uiValue;
                vmo.props.argument_value.dbValue = [ data.argumentValueTextBox.uiValue ];
                vmo.props.argument_value.uiValue = data.argumentValueTextBox.uiValue;
            }
            // if value not present in free form text then take lov selected value and update in argumentToValueMap
        } else {
            if( data.readOnlyArgumentName.uiValue !== '' ) {
                vmo.props.argument_value.dbValue = [ data.argumentValues.dbValue ];
            } else if( data.argumentNames.uiValue !== '' ) {
                vmo.uid = [ data.argumentNames.uiValue ];
                vmo.id = data.argumentNames.uiValue;
                vmo.props.argument_value.dbValue = [ data.argumentValues.dbValue ];
                vmo.props.argument_value.uiValue = data.argumentValues.dbValue;
            }
        }
        //if only multiselect is true
    } else if( data.multiselect && data.argumentValueslist.length > 0 ) {
        var value = data.argumentValuesMultiselect.dbValue.toString();
        if( data.readOnlyArgumentName.uiValue !== '' ) {
            vmo.props.argument_value.dbValue = [ value ];
            vmo.props.argument_value.uiValue = value;
        } else if( data.argumentNames.uiValue !== '' ) {
            vmo.uid = [ data.argumentNames.uiValue ];
            vmo.id = data.argumentNames.uiValue;
            vmo.props.argument_value.dbValue = [ value ];
            vmo.props.argument_value.uiValue = value;
        }
    } else if( data.argumentValueslist.length === 0 ) {
        if( data.readOnlyArgumentName.uiValue !== '' ) {
            vmo.props.argument_value.dbValue = [ data.argumentValueTextBox.uiValue ];
        } else if( data.argumentNames.uiValue !== '' ) {
            vmo.uid = [ data.argumentNames.uiValue ];
            vmo.id = data.argumentNames.uiValue;
            if( data.argHasNullValue ) {
                vmo.props.argument_value.dbValue = [];
                vmo.props.argument_value.uiValue = '';
            } else {
                vmo.props.argument_value.dbValue = [ data.argumentValueTextBox.uiValue ];
                vmo.props.argument_value.uiValue = data.argumentValueTextBox.uiValue;
            }
        } else if( vmo.isUndefinedArgRow === true ) {
            vmo.uid = [ data.argumentNameTextBox.dbValue ];
            vmo.id = data.argumentNameTextBox.dbValue;
            vmo.props.argument_name.dbValue = [ data.argumentNameTextBox.dbValue ];
            vmo.props.argument_name.uiValue = data.argumentNameTextBox.dbValue;
            vmo.props.argument_value.dbValue = [ data.argumentValueTextBox.dbValue ];
            vmo.props.argument_value.uiValue = data.argumentValueTextBox.dbValue;
        }
    } else if( data.argumentValueslist.length > 0 ) {
        if( data.readOnlyArgumentName.uiValue !== '' ) {
            vmo.props.argument_value.dbValue = [ data.argumentValues.dbValue ];
            vmo.props.argument_value.uiValue =  data.argumentValues.dbValue;
        } else if( data.argumentNames.uiValue !== '' ) {
            props.subPanelContext.vmo.uid = [ data.argumentNames.uiValue ];
            vmo.id = data.argumentNames.uiValue;
            vmo.props.argument_value.dbValue = [ data.argumentValues.dbValue ];
            vmo.props.argument_value.uiValue =  data.argumentValues.dbValue;
        }
    }
    if( data.argumentNameslist.length === 1 ) {
        data.isAddHandlerArgumentPanelVisible = false;
    }
};

/**
   *  Remove handler arguments operation
   * @param {Object} context - context
   */
export let awp0RemoveHandlerArgumentPanelSection = function( context ) {
    var index = context.selectedHandlerArguments.arguments.findIndex( function( argument ) {
        return argument.uid === context.selectedArgument.uid;
    } );
    if( index > -1 ) {
        context.selectedHandlerArguments.arguments[index].isDeleted = true;
        eventBus.publish( 'updateSelectedHandlerArgumentsWhenRemove', {
            selectedHandlerArguments: context.selectedHandlerArguments,
            index:index
        } );
        eventBus.publish( 'clearArgumentValueTextBoxEvent', { selectedArgument : context.selectedArgument } );
    }
};

/**
   *  Populate argument values dynamically for respective argument name when we changes the argument names for the argumentNames LOV widget
   * @param {Object} data - current data
   * @param {Object} handlerRelatedData - data of handlers tree table
   * @param{Object} vmo - current vmo
   * @return {object} argument value list for selected argument in argumentNames LOV widget
   */
export let populateArgumentValues = function( data, handlerRelatedData, vmo, argumentToValueMap, ctx, props ) {
    if( !handlerRelatedData ) {
        return null;
    }
    data.argumentValueTextBox.dbValues = [];
    data.argumentValueTextBox.uiValue = '';
    data.argumentValueTextBox.dbValue = '';
    data.argumentValuesMultiselect.dbValue = [];
    data.argumentValuesMultiselect.uiValue = '';
    data.argumentValues.dbValue = [];
    data.argumentValues.uiValue = '';
    //If we change argumentNames then previous argument_value should be empty
    vmo.props.argument_value.uiValue = '';
    vmo.props.argument_value.dbValue = '';
    vmo.props.argument_name.dbValue = [ data.argumentNames.dbValue ];
    _GetHintMessage( data, props, handlerRelatedData?.handlerData );


    return exports.populateArgumentValueslist( data, handlerRelatedData, vmo, argumentToValueMap, ctx, props );
};
/**
   *  Populate Rule Quorum Values for selected Rule
   * @param {Object} existingRuleHandlersLength - existingHandlersLength in Rule
   * @return {Array} List of possible values for rule quorum
   */
export let populateRuleQuorumValues = function( existingRuleHandlersLength ) {
    var list = [];
    for( var i = existingRuleHandlersLength; i > 0; i-- ) {
        var temp = i.toString();
        list.push( temp );
    }
    return _listBoxSvc.createListModelObjectsFromStrings( list );
};
/**
   *  Empty LOV value for action or rule hanlder when we change option Rule or action on radio button
   * @param {Object} data - data
   * @return {Array} empty value for Rule or Action widgets
   */
export let emptyPreviousLOV = function( data ) {
    let actionHandlersLOV = { ...data.actionHandlersLOV };
    let ruleHandlersLOV = { ...data.ruleHandlersLOV };
    actionHandlersLOV.dbValue = '';
    actionHandlersLOV.uiValue = '';
    ruleHandlersLOV.dbValue = '';
    ruleHandlersLOV.uiValue = '';
    return {
        actionHandlersLOV: actionHandlersLOV,
        ruleHandlersLOV: ruleHandlersLOV
    };
};

export let updateSelectedHandlerArgumentsWhenRemove = function( selectedHandlerArguments, index ) {
    const selectedHandlerArguments1 = { ...selectedHandlerArguments.value };
    selectedHandlerArguments1.arguments.splice( index, 1 );
    selectedHandlerArguments.update && selectedHandlerArguments.update( selectedHandlerArguments1 );
};

/**
 * Generate a value array and related outputs to mock list values
 * @param startIndex - index of first value
 * @param filter - value filter
 * @param data - data
 * @return {Object} - values
 */
export let generateListValues = function(  startIndex, filterString, data ) {
    var outputVals = [];
    var moreValuesExist = true;
    if( !filterString ) {
        filterString = data.argumentValuesMultiselect.filterString;
    }
    if( filterString ) {
        const matches = data.argumentValueslist.filter( element => {
            if ( element.propDisplayValue.toLowerCase().includes( filterString.toLowerCase() ) ) {
                return true;
            }
        } );

        moreValuesExist = false;
        outputVals = matches;
    } else {
        // return 20 at a time
        var inx = 0;
        while( outputVals.length < 20 ) {
            var count = startIndex + inx;
            if( count >= data.argumentValueslist.length ) {
                moreValuesExist = false;
                break;
            }
            outputVals.push( data.argumentValueslist[count] );
            // var val = listID + ' ' + count;
            inx++;
        }
    }

    return {
        vals: outputVals,
        moreValuesExist: moreValuesExist
    };
};

/**
 * Check if hint message needs to be shown or not based on the arguments given
 *
 * @param { Object } data - viewModel data
 * @param { Object } selectedHandlerArguments - selectedArguments from the UI
 *
 * @returns { Boolean } true or false based on if Hint is needed or not
 */
var _checkIfHintNeeded = function( data, selectedHandlerArguments ) {
    let isTargetTaskPresent = false;
    _.forEach( selectedHandlerArguments?.arguments, function( selectedArgument ) {
        if( data.argumentNames.dbValue === '-target_task' ||  selectedArgument && selectedArgument.uid && selectedArgument.uid[0] && selectedArgument.uid[0] === '-target_task' ) {
            isTargetTaskPresent = true;
        }
    } );
    return isTargetTaskPresent;
};

/**
 * Show hint message when -target_task is specified without -to_attach
 *
 * @param { Object } data - viewmodel data
 * @param { Object } props - props
 * @param { Object } handlerData - handlerData of Handler
 *
 */
var _GetHintMessage = function( data, props, handlerData ) {
    if( props && props.selectedHandlerArguments?.arguments?.length > 0 && handlerData?.dependent?.length > 0 ) {
        let isHintNeeded = _checkIfHintNeeded( data, props.selectedHandlerArguments );
        if( isHintNeeded ) {
            let toAttach = false;
            _.forEach( handlerData.dependent, function( dependent ) {
                let value = dependent['-target_task'];
                if( value?.[0] === '-to_attach' ) {
                    toAttach = true;
                }
            } );

            // logic to populate Hint message
            if( toAttach && data?.i18n ) {
                eventBus.publish( 'showHintMessageForTargetTaskArgument', {
                    hint : msgsvc.applyMessageParams( data.i18n.hintMessageForTargetTaskArg )
                } );
            }
        }
    }
};

/**
 * Show hint message to the user on handlers tab
 *
 * @param { Object } data - viewmodel data
 * @param { Object } hintMessage - hintMessage to be shown
 * @param { Object } fields - fields data
 *
 *
 */
export let populateHintMessage = function( data, hintMessage, fields ) {
    if( data && data.hint && hintMessage ) {
        data.hint.dbValues[0] = hintMessage;
        data.hint.uiValue = hintMessage;
        data.hint.targetTaskCase = true;
        if( fields && fields.hint ) {
            fields.hint.update( data.hint.dbValues, { uiValue: data.hint.uiValue }, { markModified: true, runValidation: true } );
        }
    }
};

export default exports = {
    populateHandlersLOV,
    populateArgumentValueslist,
    populateArgumentNameslist,
    populateArgumentValues,
    populateHandlerInfo,
    populateArgumentsTableForSelectedHandler,
    populateHandlerPanelData,
    createOrUpdateHandler,
    addHandlerArgumentRow,
    addUndefinedHandlerArgumentRow,
    awp0RemoveHandlerArgumentPanelSection,
    updateArgumentValueMap,
    populateRuleQuorumValues,
    emptyPreviousLOV,
    updateSelectedHandlerArgumentsWhenRemove,
    generateListValues,
    populateHintMessage,
    clearArgumentValueTextBoxAction
};


