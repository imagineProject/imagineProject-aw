// Copyright (c) 2022 Siemens

/**
 * This implements the tooltip handler interface APIs defined by aw-graph widget to provide tooltip functionalities.
 *
 * @module js/Awp0WorkflowDesignerUtils
 */
import AwStateService from 'js/awStateService';
import appCtxSvc from 'js/appCtxService';
import clientDataModel from 'soa/kernel/clientDataModel';
import viewModelObjectSvc from 'js/viewModelObjectService';
import tcViewModelObjectSvc from 'js/tcViewModelObjectService';
import uwPropertySvc from 'js/uwPropertyService';
import iconSvc from 'js/iconService';
import msgSvc from 'js/messagingService';
import navigationSvc from 'js/navigationService';
import AwPromiseService from 'js/awPromiseService';
import tcDataMgmtSvc from 'js/tcDataManagementService';
import listBoxService from 'js/listBoxService';
import parsingUtils from 'js/parsingUtils';
import localeSvc from 'js/localeService';
import _ from 'lodash';

let workflowKeyRoleType = '';
let dpKeyRoleType = '';
let projectKeyRoleType = '';
let anyString = '';


localeSvc.getLocalizedTextFromKey( 'WorkflowCommandPanelsMessages.Workflow' ).then( result => workflowKeyRoleType = result );
localeSvc.getLocalizedTextFromKey( 'WorkflowDesignerMessages.dynamicParticipants' ).then( result => dpKeyRoleType = result );
localeSvc.getLocalizedTextFromKey( 'TCUICommandPanelsMessages.projectsSectionTitle' ).then( result => projectKeyRoleType = result );
localeSvc.getLocalizedTextFromKey( 'WorkflowCommandPanelsMessages.any' ).then( result => anyString = result );

var exports = {};

var _nonInteractiveNodeHeightAdjustment = 25;

/**
  * Check if input process template stage value is 1 or not. If 1 then only return true.
  * @param {Object} template Process template object
  *
  * @return {boolean} -  true/false value
  */
var _isTemplateUnderConstruction = function( template ) {
    var modelObject = clientDataModel.getObject( template.uid );
    if( modelObject && modelObject.props && modelObject.props.stage.dbValues &&
         modelObject.props.stage.dbValues[ 0 ] === '1' ) {
        return true;
    }
    return false;
};

/**
  * Check if input process template is under construction or not and logged in group
  * is dba along with Tc server version should be Tc 12.3 or more.
  *
  * @param {Object} selectedProcessTemplate Process template for diagram is shown
  * @param {Object} ctx Context object
  *
  * @return {boolean} -  true/false value
  */
export let isTemplateEditMode = function( selectedProcessTemplate, ctx ) {
    if( !selectedProcessTemplate || !ctx ) {
        return false;
    }
    var editObjectUids = null;
    // Check if editObjectUids is present directly on input ctx that means it's not
    // app context object so use that else consider it as app context object.
    if( ctx && ctx.editObjectUids ) {
        editObjectUids = ctx.editObjectUids;
    } else if( ctx.workflowDgmEditCtx && ctx.workflowDgmEditCtx.editObjectUids ) {
        editObjectUids = ctx.workflowDgmEditCtx.editObjectUids;
    }
    // Check if object is present in edit list then only return true
    if( editObjectUids && editObjectUids.indexOf( selectedProcessTemplate.uid ) > -1 ) {
        return true;
    }

    return false;
};

/**
  * Get the input obejct property and return the internal value.
  *
  * @param {Object} modelObject Model object whose propeties need to be loaded
  * @param {String} propName Property name that need to be checked
  *
  * @returns {Array} Property internal values array
  */
var _getParentPropValue = function( modelObject, propName ) {
    var parentPropValue = null;
    if( modelObject && modelObject.props[ propName ] ) {
        var values = modelObject.props[ propName ].dbValues;
        if( values && values[ 0 ] ) {
            parentPropValue = values[ 0 ];
        }
    }
    return parentPropValue;
};

/**
  * This method check if selected template is task template or not. If not then it will directly
  * return true else it will check template_name property for task template and if it matches with
  * OOTB task template list then return false else it will return true.
  * @param {Object} selTemplate Process template object
  *
  * @returns {Boolean} True/False value.
  */
export let isOOTBTaskTempleGraphEditable = function( selTemplate ) {
    var isTaskTemplate = exports.isSelectedTaskTemplate( selTemplate );
    var OOTBTaskTemplateValues = [ 'Acknowledge Task', 'Add Status Task', 'Route Task', 'Condition Task',
        'Do Task', 'Or Task', 'Validate Task', 'Review Task', 'Task'
    ];

    if( isTaskTemplate ) {
        var templateNamePropValue = _getParentPropValue( selTemplate, 'template_name' );
        if( templateNamePropValue && OOTBTaskTemplateValues.indexOf( templateNamePropValue ) > -1 ) {
            return false;
        }
    }
    return true;
};

/**
  * Check if input template is task template or not and based on that it returns true or false.
  * If it's template_classification value is 1 that means its a task template else it's process
  * template.
  * @param {Object} selTemplate Selected template for list is shown
  *
  * @return {boolean} -  true/false value
  */
export let isSelectedTaskTemplate = function( selTemplate ) {
    var isTaskTemplate = false;
    if( !selTemplate || !selTemplate.props ) {
        return isTaskTemplate;
    }
    if( selTemplate.props.template_classification && selTemplate.props.template_classification.dbValues &&
         selTemplate.props.template_classification.dbValues[ 0 ] === '1' ) {
        isTaskTemplate = true;
    }
    return isTaskTemplate;
};

/**
  * Get the action handlers from input property object. If input handler name
  * is not null then add those specific handlers only.
  * @param {Object} propObject handler proeprty obejct
  * @param {String} actionHandlerName Action ahndler name
  *
  * @return {ObjectArray} -  Action handlers array
  */
var _getPropValues = function( propObject, actionHandlerName ) {
    var propValues = [];
    if( propObject && propObject.dbValues && propObject.dbValues.length > 0 ) {
        _.forEach( propObject.dbValues, function( dbValue ) {
            var object = clientDataModel.getObject( dbValue );
            if( object ) {
                if( !actionHandlerName ) {
                    propValues.push( object );
                } else if( actionHandlerName && object.props.object_string.dbValues &&
                     object.props.object_string.dbValues[ 0 ] === actionHandlerName ) {
                    propValues.push( object );
                }
            }
        } );
    }
    return propValues;
};

/**
  * Get all action handler on input tempalte object.
  * @param {Object} selectedObject Selected task template object
  * @param {String} actionHandlerName Specific action handler to find
  *
  * @return {ObjectArray} -  Action handlers array
  */
export let getActionHandler = function( selectedObject, actionHandlerName ) {
    if( !selectedObject || !selectedObject.props.action_handlers ) {
        return null;
    }
    return _getPropValues( selectedObject.props.action_handlers, actionHandlerName );
};

/**
  * Get all action handler on input tempalte object.
  * @param {Object} selectedObject Selected task template object
  * @param {String} actionHandlerName Specific action handler to find
  *
  * @return {ObjectArray} -  Action handlers array
  */
export let getActionHandlerOnProp = function( selectedObject, propName, actionHandlerName ) {
    if( !selectedObject || !selectedObject.props[ propName ] ) {
        return null;
    }
    return _getPropValues( selectedObject.props[ propName ], actionHandlerName );
};

/**
  * Get the handler arguments in an array from input db values array.
  *
  * @param {Object} handlerArgumentDBValues Handler argument db values array
  *
  * @return {ObjectArray} argumentParameters Handler argument array
  */
export let parseHandlerArguments = function( handlerArgumentDBValues ) {
    var argumentParameters = {};
    if( !handlerArgumentDBValues || handlerArgumentDBValues.length <= 0 ) {
        return argumentParameters;
    }
    // Check if input is an array then join all values in to one string before splitting
    if( _.isArray( handlerArgumentDBValues ) ) {
        handlerArgumentDBValues = handlerArgumentDBValues.join( '' );
    }

    var splitArgumentValues = handlerArgumentDBValues.split( '\n' );

    _.forEach( splitArgumentValues, function( argumentValue ) {
        var tempValues = argumentValue.split( '=' );
        if( tempValues && tempValues[ 0 ] && tempValues[ 1 ] ) {
            argumentParameters[ tempValues[ 0 ] ] = tempValues[ 1 ];
        } else if( tempValues && tempValues[ 0 ] ) {
            // If there is no value present for specific argument type then we need to use it
            // as empty string. This is needed to create or update hadnler case as well where
            // for some arguments no values are present. So to handle this case we are usign empty string
            argumentParameters[ tempValues[ 0 ] ] = '';
        }
    } );
    return argumentParameters;
};

/**
  * Add handler argument row in handler argument table
  * @param {Array} columns Array that is being shown in table
  * @param {String} rowId Row id that will be specific for each handler argument row
  * @param {String} actionType Action type string display value
  * @param {String} argumentName Argument name value that need to be populated
  * @param {String} argumentValue Argument value that need to be popilated
  * @param {Object} data Data view model object
  * @returns {Object} Create VMO object to show handler arguments
  */
var _addHandlerArgumentRowVMOObject = function( columns, rowId, actionType, argumentName, argumentValue, data ) {
    var vmObject = tcViewModelObjectSvc.createViewModelObjectById( 'AAAAAAA' + rowId );
    vmObject.type = 'HandlerArgument';
    vmObject.id = argumentName + rowId;

    // Iterate for all column info variables and populate the properties on VMO object
    _.forEach( columns, function( tableColumn ) {
        var value = argumentName;
        var dbValue = value;
        var dispValue = value;
        var isKeyRoleProp = false;

        if( tableColumn.name === 'assignmentValue' ) {
            dbValue = argumentValue;
            dispValue = argumentValue;
            if( dbValue.includes( '$' ) ) {
                var internalDbValue = dbValue.substring( dbValue.indexOf( '$' ) + 1, dbValue.length );
                if( data.i18n[ internalDbValue ] ) {
                    dispValue = data.i18n[ internalDbValue ];
                }
            }
            isKeyRoleProp = true;
        } else if( tableColumn.name === 'actionType' && actionType && actionType.length > 0 ) {
            dbValue = actionType;
            dispValue = actionType;
        }

        var dbValues = [ dbValue ];
        var displayValues = [ dispValue ];

        var vmProp = uwPropertySvc.createViewModelProperty( tableColumn.name, tableColumn.displayName,
            'STRING', dbValues, displayValues );

        if( isKeyRoleProp ) {
            var keyRoleProp = uwPropertySvc.createViewModelProperty( 'keyRole', 'keyRole',
                'STRING', dbValue, displayValues );
            keyRoleProp.dbValues = dbValues;
            keyRoleProp.uiValues = displayValues;
            vmObject.props.keyRole = keyRoleProp;
        }

        vmProp.propertyDescriptor = {
            displayName: tableColumn.displayName
        };
        vmObject.props[ tableColumn.name ] = vmProp;
    } );
    return vmObject;
};

/**
  * Add handler argument row in handler argument table
  * @param {Object} data Data view model object
  * @param {Array} columns Array that is being shown in table
  * @param {Object} selection Selected handler object for handler info needs to be populated
  * @param {boolean} isAutoAssign Is user trying to populate auto assign handler or not
  * @param {boolean} isNotificationTab Is user is in notification tab or not
  *
  * @returns {Object} Create VMO object to show handler arguments
  */
export let getHandlerRows = function( data, columns, selection, isAutoAssign, isNotificationTab ) {
    var argumentRows = [];
    // Check if input handler object don't have properties loaded then no need to process further and
    // return from here
    if( !selection || !selection.props || !selection.props.arguments || !selection.props.arguments.dbValues ) {
        return argumentRows;
    }
    var argumentValues = exports.parseHandlerArguments( selection.props.arguments.dbValues );
    var rowNumber = 1;
    _.forOwn( argumentValues, function( argumentValue, argumentName ) {
        if( argumentName === '-assignee' || argumentName === '-recipient' ) {
            var assigneeLabel = data.i18n.assignee;
            var reviewerLabel = data.i18n.reviewerLabel;
            var recipientLabel = data.i18n.recipientLabel;
            var assignmentType = assigneeLabel;
            if( !isAutoAssign ) {
                assignmentType = reviewerLabel;
            }

            // Check if user is in notification tab then we need to show label as recipient instead of reviewer
            if( isNotificationTab ) {
                assignmentType = recipientLabel;
            }
            var splitArgumentValues = null;
            // Split all assignee values with ',' then parse it to key roles in one array
            // and others teamcenter argument in another array
            if( appCtxSvc.ctx.preferences.EPM_ARG_target_user_group_list_separator && appCtxSvc.ctx.preferences.EPM_ARG_target_user_group_list_separator.length > 0 && appCtxSvc.ctx.preferences.EPM_ARG_target_user_group_list_separator[0].trim() !== '' ) {
                splitArgumentValues = argumentValue.split( appCtxSvc.ctx.preferences.EPM_ARG_target_user_group_list_separator[0] );
            }else{
                splitArgumentValues = argumentValue.split( ',' );
            }
            var actionType = -1;
            // Get the action type int value and based on that get the dispaly string value and use that to show on the table
            if( selection.props.parent_action_type && selection.props.parent_action_type.dbValues &&
                 selection.props.parent_action_type.dbValues[ 0 ] && data.actionTypeValues ) {
                actionType = parseInt( selection.props.parent_action_type.dbValues[ 0 ] );
                for( var index = 0; index < data.actionTypeValues.length; index++ ) {
                    if( data.actionTypeValues[ index ].propInternalValue === actionType ) {
                        actionType = data.actionTypeValues[ index ].propDisplayValue;
                        break;
                    }
                }
            }
            // Iterate for all arguemtn types and poluate the rows to show in table
            _.forEach( splitArgumentValues, function( splitValue ) {
                var value = splitValue.substring( splitValue.indexOf( ':' ) + 1, splitValue.length );
                if( value ) {
                    var vmObject = _addHandlerArgumentRowVMOObject( columns, rowNumber, actionType, assignmentType, value, data );
                    vmObject.handlerObject = selection;
                    rowNumber++;
                    argumentRows.push( vmObject );
                }
            } );
        }
    } );
    return argumentRows;
};

/**
  * Check if input object is of type input type. If yes then
  * return true else return false.
  *
  * @param {Object} obj Object to be match
  * @param {String} type Object type to match
  *
  * @return {boolean} True/False
  */
var isOfType = function( obj, type ) {
    if( obj && obj.modelType && obj.modelType.typeHierarchyArray.indexOf( type ) > -1 ) {
        return true;
    }
    return false;
};

/**
  * Get the sub child of route task and if user is asking for child of route task then return
  * true else retrn false.
  * @param {String} taskType Task type that need to match
  *
  * @returns {boolean} True/False value
  */
var _isChildTypeForRouteNeeded = function( taskType ) {
    if( taskType === 'EPMReviewTaskTemplate' || taskType === 'EPMAcknowledgeTaskTemplate' || taskType === 'EPMNotifyTaskTemplate' ) {
        return true;
    }
    return false;
};

/**
  * Get the valid template obejct based on selection and input type where
  * handkler info need to be added or dispalyed.
  *
  * @param {Object} templateObject template object for handler need to be populated
  * @param {String} taskType Task type that need to be fetched
  *
  * @returns {Object} Valid template object based on input type else null
  */
export let getValidTemplateObject = function( templateObject, taskType ) {
    var validTemplateObject = null;
    var modelObject = templateObject;
    if( !templateObject ) {
        return null;
    }

    // Check if input obejct is of type input task type value then return the
    // input object directly
    if( isOfType( templateObject, taskType ) ) {
        return templateObject;
    }

    // Check if input selected is rote task template then get the review task template
    // from it's child template
    if( isOfType( templateObject, 'EPMRouteTaskTemplate' ) ) {
        var subTasksProp = templateObject.props.subtask_template;
        var isChildNeeded = _isChildTypeForRouteNeeded( taskType );
        if( subTasksProp && subTasksProp.dbValues ) {
            for( var idx = 0; idx < subTasksProp.dbValues.length; idx++ ) {
                var childObject = clientDataModel.getObject( subTasksProp.dbValues[ idx ] );
                if( childObject ) {
                    if( isOfType( childObject, taskType ) ) {
                        return childObject;
                    } else if( !isChildNeeded && isOfType( childObject, 'EPMReviewTaskTemplate' ) ) {
                        modelObject = childObject;
                        break;
                    }
                }
            }
        }
    }
    // Get the child template based on input task type from template and return
    if( modelObject && modelObject.props.subtask_template && modelObject.props.subtask_template.dbValues ) {
        for( var idx1 = 0; idx1 < modelObject.props.subtask_template.dbValues.length; idx1++ ) {
            var object = clientDataModel.getObject( modelObject.props.subtask_template.dbValues[ idx1 ] );
            if( object && object.type === taskType ) {
                validTemplateObject = object;
                break;
            }
        }
    }
    return validTemplateObject;
};

/**
  * Get the valid template object UID based on selection and input type where
  * handkler info need to be added or dispalyed.
  *
  * @param {Object} templateObject template object for handler need to be populated
  * @param {String} taskType Task type that need to be fetched
  *
  * @returns {Object} Valid template object based on input type else null
  */
export let getValidTemplateObjectUid = function( templateObject, taskType ) {
    var validTemplateObject = exports.getValidTemplateObject( templateObject, taskType );
    if( validTemplateObject ) {
        return validTemplateObject.uid;
    }
    return '';
};

/**
  * Check if graph item can be removed or not. This is mainly needed to check if
  * user is trying to modify review, route or acknowledge task then it should be false.
  *
  * @param {Object} graphItem Graph item object that need to be check for deletion
  *
  * @returns {boolean} True/False based on validation
  *
  */
export let canGraphItemRemoved = function( graphItem ) {
    var isValid = true;
    // Check if input graph item is edge then get the source node
    // and use that graph item for further checks
    if( graphItem && graphItem.getItemType() === 'Edge' ) {
        graphItem = graphItem.getSourceNode();
    }

    if( graphItem && graphItem.getItemType() === 'Node' && graphItem.modelObject ) {
        var parentValue = _getParentPropValue( graphItem.modelObject, 'parent_task_template' );
        var parentObject = clientDataModel.getObject( parentValue );

        // Check if source parent is not null and not of type of these three task types or
        // target parent is not null and not of type of these three task types then only we can create the
        // edge further otherwise return from here.
        // As we don't allow any connection inside these three OOTB task types so to avoid that issue checking  here
        // If user is trying to create connection from SST task to review then also in that case isParentSame variable
        // will be true from earlier checks but with below check it will not process further and return false.
        var ootbTaskArray = [ 'EPMReviewTaskTemplate', 'EPMAcknowledgeTaskTemplate', 'EPMRouteTaskTemplate' ];
        if( parentObject && ootbTaskArray.indexOf( parentObject.type ) > -1 ) {
            isValid = false;
            return isValid;
        }
    }
    return isValid;
};

var _getKeyRoleTypeValue = function( keyRoleType ) {
    if( keyRoleType === 'Workflow' ) {
        return workflowKeyRoleType;
    } else if ( keyRoleType === 'projectsSectionTitle' ) {
        return projectKeyRoleType;
    } else if ( keyRoleType === 'dynamicParticipants' ) {
        return dpKeyRoleType;
    }
    return '';
};

/**
  * Create the key role objects that need to be dispalyed on UI based on input array.
  *
  * @param {Array} objectList  Object list that need to be created
  * @param {boolean} appendDollar  True or false based on dollar need to be added on internal value
  * @param {String} anyString  Any string locale value
  *
  * @returns {Array} Key role objects array that need to be used further
  */
export let createKeyRoleObjects = function( objectList, appendDollar, anyString ) {
    var keyRoleObjects = [];
    _.forEach( objectList, function( object ) {
        if( object.internalName ) {
            var vmObject = viewModelObjectSvc.constructViewModelObjectFromModelObject( null, '' );
            vmObject.type = 'KeyRole';
            vmObject.uid = object.internalName;
            // If icon present then use that icon else use default icon
            if( object.typeIconURL ) {
                vmObject.typeIconURL = iconSvc.getTypeIconURL( object.typeIconURL );
            } else {
                vmObject.typeIconURL = iconSvc.getTypeIconURL( 'Role48' );
            }
            var propInternalValue = object.internalName;
            var propDisplayName = object.displayName;
            // Check if input append dollar as intenal vlaue is true then only append it
            if( appendDollar ) {
                propInternalValue = '$' + propInternalValue;
            }
            if( propDisplayName.indexOf( '::' ) > -1 ) {
                var keyValue = propDisplayName.split( '::' );
                // Check if key value is not null and has length > 1
                if( keyValue && keyValue.length > 1 ) {
                    // Get the 0th index value for parse and check if it is equal to * then
                    // replace the * with ANY string and set it to cell header 1 object
                    if( keyValue[ 0 ] ) {
                        if( keyValue[ 0 ] === '*' ) {
                            keyValue[ 0 ] = anyString;
                        }
                        vmObject.cellHeader1 = keyValue[ 0 ];
                    }

                    // Get the 1st index value for parse and check if it is equal to * then
                    // replace the * with ANY string and set it to cell header 2 object
                    if( keyValue[ 1 ] ) {
                        if( keyValue[ 1 ] === '*' ) {
                            keyValue[ 1 ] = anyString;
                        }
                        vmObject.cellHeader2 = keyValue[ 1 ];
                    }
                }
            } else {
                vmObject.cellHeader1 = propDisplayName;
            }
            // Check if input object has key role type then create a property and set it on keyRole VMO
            // object as cellHeader2 so that it will be shown on key role cell.
            if( object.typeName ) {
                var keyRoleDispValue = _getKeyRoleTypeValue( object.typeName );
                if( keyRoleDispValue && !_.isEmpty( keyRoleDispValue ) ) {
                    vmObject.cellHeader2 = keyRoleDispValue;

                    var keyRoleTypeProp = uwPropertySvc.createViewModelProperty( 'keyRoleType', 'keyRoleType',
                        'STRING', object.typeName, [ keyRoleDispValue ] );
                    keyRoleTypeProp.dbValues = [ object.typeName ];
                    keyRoleTypeProp.uiValues = [ keyRoleDispValue ];
                    vmObject.props.keyRoleType = keyRoleTypeProp;
                }
            }
            var vmProp = uwPropertySvc.createViewModelProperty( 'keyRole', 'keyRole',
                'STRING', propInternalValue, [ propDisplayName ] );
            vmProp.dbValues = [ propInternalValue ];
            vmProp.uiValues = [ object.displayName ];
            vmObject.props.keyRole = vmProp;
            keyRoleObjects.push( vmObject );
        }
    } );
    return keyRoleObjects;
};

/**
  * Update the input additional data with other arguemnts that is needed in update handler case.
  *
  * @param {Object} handlerContextObject If user selected any handler form notification table then contian that
  *                 handler object else null
  * @param {Object} additionalDataMap Additinal data map object
  */
export let updateAdditionalDataWithOtherArguments = function( handlerContextObject, additionalDataMap ) {
    var argumentValues = null;
    // Check if handler arguemnts are not null and values present then get the argument values
    if( handlerContextObject && handlerContextObject.props.arguments && handlerContextObject.props.arguments.dbValues &&
         handlerContextObject.props.arguments.dbValues[ 0 ] ) {
        argumentValues = exports.parseHandlerArguments( handlerContextObject.props.arguments.dbValues );
    }
    // Check if values are not null then get all keys and check if key is already not present in input
    // map then add those values as well.
    if( argumentValues ) {
        var argumentKeys = Object.keys( argumentValues );
        _.forEach( argumentKeys, function( argumentKey ) {
            if( argumentKey && !additionalDataMap[ argumentKey ] && _.startsWith( argumentKey, '-' ) ) {
                additionalDataMap[ argumentKey ] = [ argumentValues[ argumentKey ] ];
            }
        } );
    }
};

/**
  * Get the parent_task_template on input object and return that object.
  *
  * @param {Object} selection Whose parent need to be fetched
  *
  * @returns {Object} Parent task template object for input object.
  */
export let getParentTaskTemplate = function( selection ) {
    var parentTemplate = null;
    var parentValue = _getParentPropValue( selection, 'parent_task_template' );
    parentTemplate = clientDataModel.getObject( parentValue );
    return parentTemplate;
};

/**
  * Update the edit context based on input obejct UID and edit mode value. It will either
  * add to edit context list or remove it from list.
  *
  * @param {String} editContext - the current edit context object
  * @param {String} objectUid - Object Uid that need to be in edit mode or remove from edit mode
  * @param {Boolean} isEditMode True/False Edit mode need to set or remove
  */
export let updateWorkflowEditCtx = function( editContext, selectedObject, isEditMode, context ) {
    var objectUid = selectedObject;

    if ( context && context.subPanelContext && context.subPanelContext.selected ) {
        objectUid = context.subPanelContext.selected.uid;
    } else if ( context && context.selectionData && context.selectionData.pselected && context.selectionData.pselected[0] ) {
        objectUid = context.selectionData.pselected[0].uid;
    } else if ( context && context.selectionData && context.selectionData.pselected ) {
        objectUid = context.selectionData.pselected.uid;
    } else if ( context && context.openedObject ) {
        objectUid = context.openedObject.uid;
    }

    var activeCtx = appCtxSvc.getCtx( editContext );
    if( activeCtx ) {
        var objectUids = activeCtx.editObjectUids;
        // If if edit mode then add to that lsit else remove from that list
        if( isEditMode ) {
            if( objectUids && objectUids.indexOf( objectUid ) <= -1 ) {
                objectUids.push( objectUid );
            }
        } else {
            objectUids = _.filter( objectUids, function( uidString ) {
                return uidString !== objectUid;
            } );
        }
        activeCtx.editObjectUids = objectUids;
        appCtxSvc.updateCtx( editContext, activeCtx );
    } else {
        // If need to put in edit mode and edit context is not yet set then only set it
        if( isEditMode ) {
            var context = {
                editObjectUids: [ objectUid ]
            };
            appCtxSvc.registerCtx( editContext, context );
        }
    }
};
/**
  * Based on input proeprty object check for values and return the business rule object
  * along with its rule handlers.
  *
  * @param {Object} propObject Property object whose value needs to be fetched
  * @return {Array} Array that will info for all rules along with rule handlers.
  */
export let getStartActionRuleHandlers = function( propObject ) {
    var propValues = [];
    // Check if input proeprty object is not null and dbvalues are not empty then
    // only get the BusinessRule object and then gets its rule handlers
    if( propObject && propObject.dbValues && propObject.dbValues.length > 0 ) {
        _.forEach( propObject.dbValues, function( dbValue ) {
            var bRuleObject = viewModelObjectSvc.createViewModelObject( dbValue );
            // Check if BRule object is not null and rule handlers present then gets those rule handlers
            if( bRuleObject && bRuleObject.props.rule_handlers && bRuleObject.props.rule_handlers.dbValues ) {
                _.forEach( bRuleObject.props.rule_handlers.dbValues, function( childDbValue ) {
                    var childObject = viewModelObjectSvc.createViewModelObject( childDbValue );
                    if( childObject && childObject.props.object_name.dbValue === 'EPM-check-condition' ) {
                        childObject.buisnessRuleObject = bRuleObject;
                        propValues.push( childObject );
                        return propValues;
                    }
                } );
            }
        } );
    }
    return propValues;
};

/**
  * Update the URL based on input parameters.
  *
  * @param {Object} parameters Parameters that need to be added in URL.
  */
export let updateURL = function( parameters ) {
    AwStateService.instance.go( AwStateService.instance.current.name, parameters );
};

/**
  * Get the top level parent for input node.
  *
  * @param {Object} groupGraph Group graph API object
  * @param {Object} node whose parent need to be find out.
  *
  * @returns {Object} Top level parent node object.
  */
export let getTopLevelParentNode = function( groupGraph, node ) {
    if( !groupGraph || !node ) {
        return;
    }
    var parentNode = node;
    var loop = true;
    while( loop ) {
        var inputParent = parentNode;
        parentNode = groupGraph.getParent( parentNode );
        if( !parentNode ) {
            loop = false;
            parentNode = inputParent;
        }
    }
    return parentNode;
};

/**
  * Find the current offset for the displayed nodes relative to the current upper-most and left-most nodes.
  * Used to determine the position values to save for the template when displaying fixed location values.
  *
  * @param { Array} totalNodesInGraph  All node objects in graph
  * @param {Array} currentGraph the current graph
  */
export let findDeltaXYOfCurrentDiagram = function() {
    var graphContext = appCtxSvc.getCtx( 'graph' );
    var graphControl = graphContext.graphModel.graphControl;
    var graph = graphControl.graph;
    var totalNodesInGraph = graph.getNodes();

    var currentMinXValue = -9999;
    var currentMinYValue = -9999;

    var deltaX;
    var deltaY;
    var deltaArray = [];

    if( totalNodesInGraph && totalNodesInGraph.length > 0 ) {
        _.forEach( totalNodesInGraph, function( node ) {
            var position = graph.getBounds( node );
            //var parentNode = groupGraph.getParent( node );
            var positionX = position.x;
            var positionY = position.y;

            if( currentMinXValue === -9999 ) {
                currentMinXValue = positionX;
            } else if( positionX < currentMinXValue ) {
                currentMinXValue = positionX;
            }
            if( currentMinYValue === -9999 ) {
                currentMinYValue = positionY;
            } else if( positionY < currentMinYValue ) {
                currentMinYValue = positionY;
            }
        } );
        deltaX = 10 - currentMinXValue;
        deltaY = 40 - currentMinYValue;
        deltaArray[ 0 ] = deltaX;
        deltaArray[ 1 ] = deltaY;
    }
    return deltaArray;
};

export let formatNodePositionValues = function( position, node ) {
    //Calculate the top-most and left-mode values for the current nodes
    var deltaXY = exports.findDeltaXYOfCurrentDiagram();

    var finalX = position.x + deltaXY[ 0 ];
    var finalY;
    if( node && node.appData.nodeType === 'finish' || node && node.appData.nodeType === 'start' ) {
        finalY = position.y + deltaXY[ 1 ] - _nonInteractiveNodeHeightAdjustment;
    } else {
        finalY = position.y + deltaXY[ 1 ];
    }

    //scaling the position data by scaling factor
    finalX /= 1.9;
    finalX = Math.round( finalX );
    finalY /= 1.9;
    finalY = Math.round( finalY );

    return finalX + ',' + finalY;
};

export let updateFilterMap = function( filterMap ) {
    var cloneOfFilterMap = JSON.parse( JSON.stringify( filterMap ) );
    var prop = {};
    prop = cloneOfFilterMap ? cloneOfFilterMap : prop;
    return prop;
};

/**
  * Get the value based on input preference and if not found then return default value.
  *
  * @param {Object} data Data view model object


  * @param {String} prefName Preference name whose value need to be get from data
  * @param {Object} defaultValue Preference default value if preference not found
  *
  * @returns {Object} Value that need to be determined based on input preference name
  */
var _getDefaultValueBasedOnPref = function( data, prefName, defaultValue ) {
    var value = defaultValue;
    if( appCtxSvc.ctx.preferences && appCtxSvc.ctx.preferences[ prefName ] && appCtxSvc.ctx.preferences[ prefName ][ 0 ] ) {
        var prefValue = parseFloat( appCtxSvc.ctx.preferences[ prefName ][ 0 ] );
        if( !isNaN( prefValue ) && prefValue > 0 ) {
            value = prefValue;
        }
    }
    return value;
};

/**
  * Based on input arguemtn value parse the value to hour and return.


  *
  * @param {Object} argument Set duration arguemnt value that need to be parse
  *
  * @return {Object} Hour arguemtn value from input value
  */
export let getSetDurationHours = function( data, argument ) {
    var hours = 0;
    // Check if input argument is invalid then no need to process further and return null
    if( !argument ) {
        return 0;
    }
    // based on argument each individual value parse the value to hour and
    // add to hour value so that final value can be returned
    if( argument.hasOwnProperty( '-year' ) ) {
        var yearValue = parseInt( argument[ '-year' ] );
        if( !isNaN( yearValue ) && yearValue > 0 ) {
            var defaultYearValue = _getDefaultValueBasedOnPref( data, 'SM_Hours_Per_Year_Preference', 2080 );
            hours += yearValue * defaultYearValue;
        }
    }
    if( argument.hasOwnProperty( '-week' ) ) {
        var weekValue = parseInt( argument[ '-week' ] );
        if( !isNaN( weekValue ) && weekValue > 0 ) {
            var defaultWeekValue = _getDefaultValueBasedOnPref( data, 'SM_Hours_Per_Week_Preference', 40 );
            hours += weekValue * defaultWeekValue;
        }
    }

    if( argument.hasOwnProperty( '-day' ) ) {
        var dayValue = parseInt( argument[ '-day' ] );
        if( !isNaN( dayValue ) && dayValue > 0 ) {
            var defaultDayValue = _getDefaultValueBasedOnPref( data, 'SM_Hours_Per_Day_Preference', 8 );
            hours += dayValue * defaultDayValue;
        }
    }

    if( argument.hasOwnProperty( '-hour' ) ) {
        var hourValue = parseFloat( argument[ '-hour' ] );
        if( !isNaN( dayValue ) ) {
            hours += hourValue;
        }
        hours += hourValue;
    }

    if( argument.hasOwnProperty( '-minute' ) ) {
        var minuteValue = parseInt( argument[ '-minute' ] );
        if( !isNaN( minuteValue ) && minuteValue > 0 ) {
            var value = parseFloat( minuteValue / 60 );
            hours += value;
        }
    }
    return Math.round( hours );
};
export let applyTemplateToProcessPartialSuccessfulMsgAction = function( data, updatedProcesses, failedProcesses ) {
    var totalProcesses = updatedProcesses.length + failedProcesses.length;
    var msg = '';
    msg = msg.concat( data.i18n.applyTemplateToProcessPartialSuccessfulMsg.replace( '{0}', updatedProcesses.length ) );
    msg = msg.replace( '{1}', totalProcesses );
    msgSvc.showInfo( msg );
};

export let navigateToHelpLink = function( seletedHandler ) {
    var navigateTo = 'https://docs.sw.siemens.com/en-US/doc/282219420/PL20231129261301184.xid1760236/';
    if( seletedHandler.type === 'EPMBRHandler' || seletedHandler.type === 'EPMBusinessRule' ) {
        navigateTo += 'rule_handlers_intro';
    }else{
        navigateTo += 'action_handlers_intro';
    }
    exports.navigateToURL( navigateTo );
};

/**
  * Check if selected template is review, route, acknowledge , SST or PS then return true or false
  * @param {Object} selectedObject Selected template object from graph
  *
  * @returns {boolean} True/false
  */
var _isReviewAckOrRouteSSTOrPSTaskTemplateSelected = function( selectedObject ) {
    var isReviewAckRouteTaskSelected = false;
    // Check if input is not null and is one of these types then only return true
    if( selectedObject && selectedObject.modelType && ( selectedObject.modelType.typeHierarchyArray.indexOf( 'EPMReviewTaskTemplate' ) > -1 || selectedObject.modelType.typeHierarchyArray.indexOf( 'EPMAcknowledgeTaskTemplate' ) > -1 ||
             selectedObject.modelType.typeHierarchyArray.indexOf( 'EPMRouteTaskTemplate' ) > -1 ||
             selectedObject.modelType.typeHierarchyArray.indexOf( 'EPMSelectSignoffTaskTemplate' ) > -1 ||
             selectedObject.modelType.typeHierarchyArray.indexOf( 'EPMPerformSignoffTaskTemplate' ) > -1 ) ) {
        isReviewAckRouteTaskSelected = true;
    }
    return isReviewAckRouteTaskSelected;
};

/**
  * Get the valid template types based on input task template object and return the task types
  * array.
  * @param {Object} taskTemplateObject Selected task template object
  * @param {Array} templateTypes Template types array that have all tempalte types present in system
  *
  * @returns {Array} Valid task template types array
  */
var _getValidTemplateTypes = function( taskTemplateObject, templateTypes ) {
    var taskTypes = [];
    var ootbTaskArray = [ 'EPMReviewTaskTemplate', 'EPMAcknowledgeTaskTemplate', 'EPMRouteTaskTemplate', 'EPMAddStatusTaskTemplate',
        'EPMConditionTaskTemplate', 'EPMDoTaskTemplate', 'EPMOrTaskTemplate',
        'EPMValidateTaskTemplate', 'EPMSelectSignoffTaskTemplate', 'EPMPerformSignoffTaskTemplate',  'EPMNotifyTaskTemplate', 'ECMChecklistTaskTemplate',
        'ECMImpactAnalysisTaskTemplate', 'ECMPrepareECOTaskTemplate', 'EPMSyncTaskTemplate', 'EPMTaskTemplate' ];
    var selectedTaskTemplateType = taskTemplateObject.type;
    if( !selectedTaskTemplateType ) {
        selectedTaskTemplateType = 'EPMTaskTemplate';
    }
    _.forEach( templateTypes, function( templateType  ) {
        if( selectedTaskTemplateType && ( selectedTaskTemplateType === templateType.propInternalValue || ootbTaskArray.indexOf( templateType.propInternalValue ) < 0 ) ) {
            taskTypes.push( templateType );
        }
    } );
    return taskTypes;
};

/**
  * Get the valid template types based on input task template object and return the task types
  * array. If user selected review , route or acknowledge, SST or PS task template then return those types only as
  * right now we don't support createing it's obejct of different type.
  *
  * @param {Object} taskTemplateObject Selected task template object
  * @param {Array} templateTypes Template types array that have all tempalte types present in system
  *
  * @returns {Array} Valid task template types array
  */
export let getValidTaskTemplateTypeList = function( taskTemplateObject, templateTypes ) {
    var taskTemplateTypes = [];
    taskTemplateTypes = templateTypes;
    if( !taskTemplateObject ) {
        return [];
    }
    if( taskTemplateObject && taskTemplateObject.uid && _isReviewAckOrRouteSSTOrPSTaskTemplateSelected( taskTemplateObject ) ) {
        var defaultTaskTemplate = _.find( templateTypes, function( templateType ) {
            return templateType.propInternalValue === taskTemplateObject.type;
        } );
        if( defaultTaskTemplate ) {
            return [ defaultTaskTemplate ];
        }
        return [];
    }
    // Get all valid types to be shown in UI
    taskTemplateTypes = _getValidTemplateTypes( taskTemplateObject, templateTypes );
    return taskTemplateTypes;
};

/**
  * Navigate to the input URL in new tab
  * @param {String} urlString URL string that need to open
  */
export let navigateToURL = function( urlString ) {
    if( urlString ) {
        var action = { actionType: 'Navigate' };
        action.navigateTo = urlString;
        action.navigationParams = {};
        action.navigateIn = 'newTab';
        navigationSvc.navigate( action, action.navigationParams );
    }
};

/**
  * Get the input obejct property and return the internal or display value.
  *
  * @param {Object} modelObject Model object whose propeties need to be loaded
  * @param {String} propName Property name that need to be checked
  * @param {boolean} isDispValue Display value need to be get or internal value
  *
  * @returns {Array} Property internal value or display value
  */
var _getObjectPropValue = function( modelObject, propName, isDispValue ) {
    var propValue = null;
    if( modelObject && modelObject.props[ propName ] ) {
        var values = null;
        if( isDispValue ) {
            values = modelObject.props[ propName ].uiValues;
        } else {
            values = modelObject.props[ propName ].dbValues;
        }
        if( values && values[ 0 ] ) {
            propValue = values[ 0 ];
        }
    }
    return propValue;
};


/**
  * Get the group values for internal name and display name and return.
  *
  * @param {Object} modelObject object from group value needs to be fetched.
  * @param {String} defaultInternalValue  Default internal property value
  *
  * @returns {Object} Object that will contain group internal name and display name
  */
export let getGroupObject = function( modelObject, defaultInternalValue ) {
    var groupInternalName = null;
    var groupDispName = null;

    groupInternalName = _getObjectPropValue( modelObject, 'REF(group,Group).object_full_name' );
    var groupUid = _getObjectPropValue( modelObject, 'group' );
    // If ref property is not present then get it from input object property group
    if( !groupInternalName && groupUid ) {
        var groupObject = clientDataModel.getObject( groupUid );
        groupInternalName = _getObjectPropValue( groupObject, 'object_full_name' );
    }
    // Check if default value is not present then use empty string as defualt value
    if( !defaultInternalValue ) {
        defaultInternalValue = '';
    }
    // Default value for group internal name
    if( !groupInternalName ) {
        groupInternalName = defaultInternalValue;
    }
    // Get the group display name from group object of input object
    if( groupUid ) {
        groupObject = clientDataModel.getObject( groupUid );
        groupDispName = _getObjectPropValue( groupObject, 'object_string', true );
    }

    // Default value for group display name
    if( !groupDispName ) {
        groupDispName = '*';
    }

    return {
        groupInternalName : groupInternalName,
        groupDispName : groupDispName
    };
};

/**
  * Get the role values for internal name and display name and return.
  *
  * @param {Object} modelObject object from role value needs to be fetched.
  * @param {String} defaultInternalValue  Default internal property value
  *
  * @returns {Object} Object that will contain role internal name and display name
  */
export let getRoleObject = function( modelObject, defaultInternalValue ) {
    var roleInternalName = defaultInternalValue;
    var roleDispName = '*';

    roleInternalName = _getObjectPropValue( modelObject, 'REF(role,Role).role_name' );
    var roleUid = _getObjectPropValue( modelObject, 'role' );
    // If ref proeprty is not present then get value from role property on input object
    if( !roleInternalName && roleUid ) {
        var roleObject = clientDataModel.getObject( roleUid );
        roleInternalName = _getObjectPropValue( roleObject, 'role_name' );
        roleDispName = _getObjectPropValue( roleObject, 'role_name', true );
    }
    // Check if default value is not present then use empty string as defualt value
    if( !defaultInternalValue ) {
        defaultInternalValue = '';
    }
    // Default value if null
    if( !roleInternalName ) {
        roleInternalName = defaultInternalValue;
    }

    // Get the display name from role object on input object
    if( roleUid ) {
        var roleObject = clientDataModel.getObject( roleUid );
        roleDispName = _getObjectPropValue( roleObject, 'role_name', true );
    }

    // Role default value if null
    if( !roleDispName ) {
        roleDispName = '*';
    }

    return {
        roleInternalName : roleInternalName,
        roleDispName : roleDispName
    };
};

/**
  * Get the valid template object for handler info need to be shown.
  * @param {Object} subPanelContext Sub panel context object
  * @param {Object} workflowDgmEditCtx Edit Context object
  * @returns {Object} Valid template object
  */
export let getValidTemplateVMOObject = function( subPanelContext, workflowDgmEditCtx ) {
    var vmoObject = null;
    // Check if subPanelContext is invalid or selected object is not valid then we will
    // return null as selected object from here.
    if( !subPanelContext || !subPanelContext.selected ) {
        return vmoObject;
    }

    // Get the primary selected object from subPanelContext
    var modelObject = subPanelContext.selected;
    var isPanelEditable = false;
    // Check if selected template obejct is present in edit list then only set it to true
    if( modelObject && workflowDgmEditCtx && workflowDgmEditCtx.editObjectUids ) {
        var editObjectUids = workflowDgmEditCtx.editObjectUids;
        if( editObjectUids.indexOf( modelObject.uid ) > -1 ) {
            isPanelEditable = true;
        }
    }

    // Check if subPanelContext contains workflowDgmState and workflowDgmState contains selectedObject
    // that means any node is selected from workflow graph then we will use that selection to show
    // specific object handlers info
    if( subPanelContext.workflowDgmState && subPanelContext.workflowDgmState.selectedObject ) {
        modelObject = subPanelContext.workflowDgmState.selectedObject;
    }

    // Check if object is not null then create the view model object and return from here.
    if( modelObject ) {
        modelObject = clientDataModel.getObject( modelObject.uid );
        vmoObject = viewModelObjectSvc.createViewModelObject( modelObject.uid );
    }
    return {
        rootTaskTemplateObject : subPanelContext.selected,
        selectedTemplateObject : vmoObject,
        isTemplateEditable : isPanelEditable
    };
};

/**
  * Get the group or role content based on input values and created LOV entries and return.
  *
  * @param {String} contentType Object type for which properties needs to be populated
  * @param {data} data Viewmodel data
  * @param {int} startIndex Start index value
  * @param {Object} filter Filter string to filter
  * @returns {Object} The promise for the LOV search result
  */
export let performLOVSearch = function( contentType, data, startIndex, filter ) {
    var deferred = AwPromiseService.instance.defer();

    var searchCriteria = { resourceProviderContentType: contentType };

    if ( contentType === 'Group' ) {
        var filterContent = data.allRoles.uiValue;
        if ( filterContent ) {
            searchCriteria.role = filterContent;
        }
    } else if ( contentType === 'Role' ) {
        var filterContent = data.allGroups.uiValue;
        if ( filterContent ) {
            searchCriteria.group = filterContent;
        }
    }
    // By default resource provider will be Awp0ResourceProvider
    var resourceProvider = 'Awp0ResourceProvider';

    if ( filter ) {
        searchCriteria.searchString = filter;
    }

    var inputData = {
        columnConfigInput: {
            clientName: 'AWClient',
            clientScopeURI: ''
        },
        inflateProperties: false,
        saveColumnConfigData: {},
        searchInput: {
            maxToLoad: 100,
            maxToReturn: 50,
            providerName: resourceProvider,
            searchCriteria: searchCriteria,
            cursor: {
                startIndex: startIndex,
                endReached: false,
                startReached: false,
                endIndex: 0
            },
            searchSortCriteria: [],
            searchFilterFieldSortType: 'Alphabetical'
        }
    };

    // Execute soa call to search for LOV values
    return tcDataMgmtSvc.basePerformSearchViewModel( inputData ).then( function( response ) {
        var lovEntries = [];
        var modelObjects = [];
        var endIndex;
        if ( response.searchResultsJSON ) {
            var searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );

            if ( searchResults ) {
                for ( var i = 0; i < searchResults.objects.length; i++ ) {
                    var uid = searchResults.objects[i].uid;
                    var obj = response.ServiceData.modelObjects[uid];
                    modelObjects.push( obj );
                }
            }
            if ( modelObjects ) {
                // Create the list model object that will be displayed
                var groups = listBoxService.createListModelObjects( modelObjects, 'props.object_string' );
                Array.prototype.push.apply( lovEntries, groups );
            }
            // Populate the end index and more values present or not
            endIndex = response.cursor.endIndex;
            var moreValuesExist = !response.cursor.endReached;
            if( endIndex > 0 && moreValuesExist ) {
                endIndex += 1;
            }
        }
        return {
            pageList : lovEntries,
            moreValuesExist : !response.cursor.endReached,
            totalFound : lovEntries.length,
            endIndex: response.cursor.endIndex
        };
    } );
};

/**
 * Update the user panel state based on selected user option and bring up people picker panel.
 *
 * @param {Object} addUserPanelState User panel state object that will hold info related to selection mode and other for people picker panel
 * @param {String} assignmentType Assignment type user is trying to add
 * @param {Array} workflowKeyMembers Workflow key role members as those are differnet for assignment handlers or notification handlers.
 * @param {String} selectedUserOption Selected user option that can be User, group member or resource pool.
 */
export let updateUserPanelState = function( addUserPanelState, assignmentType, workflowKeyMembers, selectedUserOption ) {
    var selectionModelMode = 'single';
    if( assignmentType !== 'assignee' && assignmentType !== 'assigner' ) {
        selectionModelMode = 'multiple';
    }
    const userState = { ...addUserPanelState.value };
    userState.assignmentType = assignmentType;
    userState.selectionModelMode = selectionModelMode;
    var isKeyRolePanel = false;

    // Check if user is trying to add key roles then only we need to set this boolean to true
    // as we need to show key roles people picker panel and in other case we show normal people
    // picker panel based on selected user option.
    if( selectedUserOption === 'keyRoles' ) {
        isKeyRolePanel = true;
        userState.workflowKeyMembers = workflowKeyMembers;
    }

    userState.isKeyRolePanel = isKeyRolePanel;
    userState.criteria.providerContentType = selectedUserOption;
    addUserPanelState.update && addUserPanelState.update( userState );
};


/**
 *
 * @param {primitive} val1 - some value
 * @param {primitive} val2 - some value
 * @param {boolean} ascending - true if compare in ascending
 * @return {number} a number which states which value is bigger
 */
var _valueComparator = function( val1, val2, ascending ) {
    if( ascending ) {
        if( val1 >= val2 ) {
            return 1;
        }
        return -1;
    }
    // here if we're in descending mode
    if( val1 <= val2 ) {
        return 1;
    }
    return -1;
};

/**
 * Given an array of modelObjects, this method sorts them by a property value
 *
 * @param {ModelObject[]} modelObjects - a given set of modelObjects
 * @param {string} sortByProp - the property to sort by
 * @param {boolean} ascending - true if the sort should be in ascending order
 * @return {ModelObject[]} - a sorted array based on a given property value
 */
export function sortModelObjectsByProp( modelObjects, sortByProp, ascending ) {
    if( Array.isArray( modelObjects ) && modelObjects.length > 1 && sortByProp ) {
        return modelObjects.sort( ( obj1, obj2 ) => {
            if( obj1.props[ sortByProp ] && !obj2.props[ sortByProp ] ) {
                if( ascending ) {
                    return -1;
                }
                return 1;
            }
            if( !obj1.props[ sortByProp ] && obj2.props[ sortByProp ] ) {
                if( ascending ) {
                    return 1;
                }
                return -1;
            }
            if( !obj1.props[ sortByProp ] && !obj2.props[ sortByProp ] ) {
                return 0;
            }
            const val1 = obj1.props[ sortByProp ].uiValues[ 0 ];
            const val2 = obj2.props[ sortByProp ].uiValues[ 0 ];
            return _valueComparator( val1, val2, ascending );
        } );
    }
    return modelObjects;
}

/**
 * Returns the resource pool group name and role name strings to be shown on UI.
 *
 * @param {Object} rpObject Resource pool model object
 * @param {String} anyString String to show be shown when group or role is null.
 * @returns {Object} Resource pool group name and role name string to be shown
 */
var _populateResourcePoolGroupRoleName = function( rpObject, anyString ) {
    var groupName = '';
    var roleName = '';
    groupName = _getObjectPropValue( rpObject, 'group', true );
    if( !groupName || _.isEmpty( groupName ) ) {
        groupName = anyString;
    }
    roleName = _getObjectPropValue( rpObject, 'role', true );
    if( !roleName || _.isEmpty( roleName ) ) {
        roleName = anyString;
    }
    return {
        groupName: groupName,
        roleName: roleName
    };
};

/**
 * Create the profile object on client side from input resoruce pool object and return that
 * profile object. This is needed in add assignment or edit profile case.
 *
 * @param {Object} resourcePoolObject Resource pool obejct from profile need to be created
 * @param {int} numberOfReviewers Number of reviewers needed for profile
 * @param {String} requiredString Required string value

 * @returns {Object} Newly created profile object from input RP object
 */
export let createProfileObjectFromRP = function( resourcePoolObject, numberOfReviewers, requiredString ) {
    var profileObject = null;
    if( !resourcePoolObject || !resourcePoolObject.uid ) {
        return profileObject;
    }
    profileObject = viewModelObjectSvc.createViewModelObject( resourcePoolObject.uid );
    profileObject.type = 'EPMSignoffProfile';
    profileObject.typeIconURL = iconSvc.getTypeIconURL( 'PersonGray48' );
    profileObject.requiredReviewersCount = numberOfReviewers;
    profileObject.requiredReviewers = numberOfReviewers.toString() + ' ' + requiredString;
    // Get the group name and role name that will be used to create the profile
    var groupRoleNameObject = _populateResourcePoolGroupRoleName( resourcePoolObject, anyString  );
    profileObject.groupRoleName = groupRoleNameObject.groupName + '/' + groupRoleNameObject.roleName;
    profileObject.isProfileCreation = true;
    profileObject.handlerName = null;
    return profileObject;
};

export default exports = {
    isTemplateEditMode,
    isOOTBTaskTempleGraphEditable,
    isSelectedTaskTemplate,
    getActionHandler,
    getActionHandlerOnProp,
    parseHandlerArguments,
    getHandlerRows,
    getValidTemplateObject,
    getValidTemplateObjectUid,
    canGraphItemRemoved,
    createKeyRoleObjects,
    updateAdditionalDataWithOtherArguments,
    getParentTaskTemplate,
    updateWorkflowEditCtx,
    getStartActionRuleHandlers,
    updateURL,
    getTopLevelParentNode,
    findDeltaXYOfCurrentDiagram,
    formatNodePositionValues,
    updateFilterMap,
    getSetDurationHours,
    applyTemplateToProcessPartialSuccessfulMsgAction,
    navigateToHelpLink,
    getValidTaskTemplateTypeList,
    navigateToURL,
    getGroupObject,
    getRoleObject,
    getValidTemplateVMOObject,
    performLOVSearch,
    updateUserPanelState,
    sortModelObjectsByProp,
    createProfileObjectFromRP
};
