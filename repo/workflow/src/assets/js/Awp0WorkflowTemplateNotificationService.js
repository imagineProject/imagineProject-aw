// Copyright (c) 2022 Siemens

/**
 * This implements the workflow template notifications related methods.
 *
 * @module js/Awp0WorkflowTemplateNotificationService
 */
import appCtxSvc from 'js/appCtxService';
import clientDataModel from 'soa/kernel/clientDataModel';
import Awp0WorkflowDesignerUtils from 'js/Awp0WorkflowDesignerUtils';
import uwPropertySvc from 'js/uwPropertyService';
import viewModelObjectService from 'js/viewModelObjectService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import tableDPReqRespHelper from 'js/tableDataProviderRequestResponseHelper';

var exports = {};

/**
 *
 * @param {Object} data Data view model object
 * @param {Array} columns table columns present in notification table
 * @param {Object} selection Handler obejct for table need to be displayed
 * @param {Object} handlerObjectStructure Obejct that will contain all handler related informaiton
 *
 * @returns {Object} Create Handler VMO object
 */
var _addHandlerArgumentRowVMOObject = function( data, columns, selection, handlerObjectStructure ) {
    var vmObject = viewModelObjectService.constructViewModelObjectFromModelObject( selection, 'Edit' );
    // Iterate for all column info variables and populate the properties on VMO object
    _.forEach( columns, function( tableColumn ) {
        var dbValue = handlerObjectStructure[ tableColumn.name ].propInternalValue;
        var dispValue = handlerObjectStructure[ tableColumn.name ].propDispValue;
        var vmProp = null;

        // Check if column name is recipients then populate the key role property as well
        // on row obejct that will contain recipients value
        if( tableColumn.name === 'recipients' ) {
            // Create the recipients property and use the input value as it is because it will be array
            // and we want to show as array values.
            vmProp = uwPropertySvc.createViewModelProperty( tableColumn.name, tableColumn.displayName,
                'STRING', dbValue, dispValue );
            vmProp.isArray = true;
            // Create the key role property and add to VMO that will be used to populate on panel
            var keyRoleProp = uwPropertySvc.createViewModelProperty( 'keyRole', 'keyRole',
                'STRING', dbValue, dispValue );
            keyRoleProp.dbValues = dbValue;
            keyRoleProp.uiValues = dispValue;
            vmObject.props.keyRole = keyRoleProp;
        } else {
            var dbValues = [ dbValue ];
            var displayValues = [ dispValue ];

            // Create the key role property
            vmProp = uwPropertySvc.createViewModelProperty( tableColumn.name, tableColumn.displayName,
                'STRING', dbValue, displayValues );
            vmProp.dbValues = dbValues;
            vmProp.uiValues = displayValues;
        }

        vmProp.propertyDescriptor = {
            displayName: tableColumn.displayName
        };
        vmObject.props[ tableColumn.name ] = vmProp;
    } );
    return vmObject;
};

/**
 * Populate the notify when column value based on input handler and where it's attached
 * @param {Object} data data Declarative view model object
 * @param {Object} handlerObject Handler object for information need to be populated
 * @param {String} handlerName Handler name string value
 * @param {Array} handlerArgumentValues Handler argument value array
 *
 * @returns {Object} Object that will contain property internal and display value
 */
var _populateNotifyWhenColumn = function( data, handlerObject, handlerName, handlerArgumentValues ) {
    var propInternalValue = null;
    var propDispValue = null;
    // Check if handler name is late notification then directly set the dispaly value as past due
    if( handlerName === 'EPM-late-notification' ) {
        propInternalValue = 'EPM-late-notification';
        propDispValue = data.i18n.taskPastDue;
    } else if( handlerName === 'EPM-notify-report' && handlerArgumentValues && handlerArgumentValues[ '-report' ] ) {
        // Check if handler name is notify report and -report argumetn present then read that value and based
        // on that value get the dispaly value from locale and return
        var reportInternalValue = handlerArgumentValues[ '-report' ];
        var reportTypeObject = _.find( data.actionTypeValues, function( actionTypeValue ) {
            return actionTypeValue.propInternalValue === reportInternalValue;
        } );
        // Check if report type obejct is not null then populate the correct values
        if( reportTypeObject ) {
            propInternalValue = reportTypeObject.propInternalValue;
            propDispValue = reportTypeObject.propDisplayValue;
        }
    }

    // Check if any value is invalid then populate the value based on action type
    if( !propInternalValue || !propDispValue ) {
        if( handlerObject.props.parent_action_type && handlerObject.props.parent_action_type.dbValues &&
            handlerObject.props.parent_action_type.dbValues[ 0 ] && data.actionTypeValues ) {
            var actionType = parseInt( handlerObject.props.parent_action_type.dbValues[ 0 ] );
            // Get the dispaly value based on action value where handler is added
            var notifyWhen = _.find( data.actionTypeValues, function( actionTypeValue ) {
                return actionTypeValue.propInternalValue === actionType;
            } );
            if( notifyWhen ) {
                propInternalValue = notifyWhen.propInternalValue;
                propDispValue = notifyWhen.propDisplayValue;
            }
        }
    }

    return {
        propInternalValue: propInternalValue,
        propDispValue: propDispValue
    };
};

/**
 * Populate the columns value based on input handler arguments
 * @param {Array} handlerArgumentValues Handler argument value array
 * @param {String} propName Property name for handler values need to be fetched
 * @returns {Object} Object that will contain property internal and display value
 */
var _populateOtherHandlerArgumentColumn = function( handlerArgumentValues, propName ) {
    var propInternalValue = null;
    var propDispValue = null;
    // Check if handler arguemnt present the subject as value then populate it else return null
    if( handlerArgumentValues && handlerArgumentValues[ propName] ) {
        propInternalValue = handlerArgumentValues[ propName ];
        propDispValue = handlerArgumentValues[ propName ];
    }
    return {
        propInternalValue: propInternalValue,
        propDispValue: propDispValue
    };
};

/**
 * Populate the key role recipient objects that will be shown on UI.
 * @param {Object} data data Declarative view model object
 * @param {Array} keyRoleRecipientsArray Key role recipient array that need to be shown on UI
 * @param {Array} dynamicParticipants Dynamic participants array that will contain participant internal name and display name
 * @param {Array} internalNameArray Internal name array that will contain all internal name values
 * @param {Array} displayNameArray Display name array that will contain all display name values
 * @returns {Array} Key role recipient objects that will be shown on UI.
 */
var _populateKeyRoleRecipients = function( data, keyRoleRecipientsArray, dynamicParticipants, internalNameArray, displayNameArray ) {
    var keyRoleRecipients = [];
    _.forEach( keyRoleRecipientsArray, function( keyRole ) {
        var internalName = keyRole;
        var displayName = keyRole;
        var internalValue = keyRole.substring( keyRole.indexOf( '$' ) + 1, keyRole.length );
        if( data.i18n[ internalValue ] ) {
            displayName = data.i18n[ internalValue ];
        } else {
            // Get the dispaly particiapnt type value based on internal particiapnt value
            var participantObject = _.find( dynamicParticipants, function( participantType ) {
                return participantType.internalName === internalName;
            } );
            if( participantObject ) {
                displayName = participantObject.displayName;
            }
        }
        internalNameArray.push( internalName );
        displayNameArray.push( displayName );
        var keyRoleObject = {
            internalName: internalName,
            displayName: displayName
        };
        keyRoleRecipients.push( keyRoleObject );
    } );
    return keyRoleRecipients;
};

/**
 * Populate the oterh recipient objects that will be shown on UI.
 * @param {Array} otherRecipientsArray Key role recipient array that need to be shown on UI
 * @param {Array} internalNameArray Internal name array that will contain all internal name values
 * @param {Array} displayNameArray Display name array that will contain all display name values
 * @returns {Array} Other recipient objects that will be shown on UI.
 */
var _populateOtherRecipients = function( otherRecipientsArray, internalNameArray, displayNameArray ) {
    var otherRecipients = [];
    _.forEach( otherRecipientsArray, function( otherRecipient ) {
        var internalName = otherRecipient;
        var displayName = otherRecipient;
        var actualObjectValue = otherRecipient;
        if( actualObjectValue.indexOf( ':' ) > -1 ) {
            displayName = otherRecipient.substring( otherRecipient.indexOf( ':' ) + 1, otherRecipient.length );
        }

        // This special handling needed for person where person name comes as 'person:Doe\, John' so while
        // rending on UI we need to replace the \, to \| first to get each assignee value because we are splitting
        // with value ',' and then to show the correct person anme replace \| back to \, to internal value and
        // ',' in the display value. Same handling is also being done on server side as well.
        if( actualObjectValue.indexOf( 'person:' ) > -1 && actualObjectValue.indexOf( '\\|' ) > -1 ) {
            internalName = internalName.replace( '\\|', '\\,' );
            displayName = displayName.replace( '\\|', ',' );
        }

        internalNameArray.push( internalName );
        displayNameArray.push( displayName );
        var otherRecipientObject = {
            internalName: internalName,
            displayName: displayName
        };
        if( actualObjectValue.indexOf( 'resourcepool:' ) > -1 || actualObjectValue.indexOf( 'allmembers:' ) > -1 ) {
            otherRecipientObject.typeIconURL = 'ResourcePool48';
            if( displayName.indexOf( '::' ) > -1 ) {
                var splitDisplayNames = displayName.split( '::' );
                if( splitDisplayNames && splitDisplayNames.length > 1 && splitDisplayNames[ 1 ] === '' ) {
                    otherRecipientObject.displayName += '*';
                }
            } else {
                otherRecipientObject.displayName = '*::' + otherRecipientObject.displayName;
            }
        }
        otherRecipients.push( otherRecipientObject );
    } );
    return otherRecipients;
};

/**
 * Populate the receipient column value based on input handler arguments
 * @param {Object} data data Declarative view model object
 * @param {Array} handlerArgumentValues Handler argument value array
 * @param {Array} dynamicParticipants Dynamic participants array
 *
 * @returns {Object} Object that will contain property internal and display value
 */
var _populateRecipientsColumn = function( data, handlerArgumentValues, dynamicParticipants ) {
    var propInternalValue = null;
    var propDispValue = null;
    // Check if handler argument is null or recipient value not present then no need to process
    // further and return from here
    if( !handlerArgumentValues || !handlerArgumentValues[ '-recipient' ] ) {
        return {
            propInternalValue: propInternalValue,
            propDispValue: propDispValue,
            keyRoleRecipients: [],
            otherRecipients: []
        };
    }
    // Get the recipient values and populate two seperate arrays, one for hard coded values
    // and other for teamcenter objects so these can be used while displaying it on panel
    var recipientValue = handlerArgumentValues[ '-recipient' ];

    // This replace is needed if there is any specific argument like person with ',' in between
    // arguemnt value so to handle that replace it with '\|'.
    recipientValue = recipientValue.replace( '\\,', '\\|' );
    var splitRecipientValues = null;
    if( appCtxSvc.ctx.preferences.EPM_ARG_target_user_group_list_separator && appCtxSvc.ctx.preferences.EPM_ARG_target_user_group_list_separator.length > 0 && appCtxSvc.ctx.preferences.EPM_ARG_target_user_group_list_separator[0].trim() !== '' ) {
        splitRecipientValues = recipientValue.split( appCtxSvc.ctx.preferences.EPM_ARG_target_user_group_list_separator[0] );
    }else{
        splitRecipientValues = recipientValue.split( ',' );
    }
    var internalRecipientValues = [];
    var dispRecipientValues = [];
    var keyRoleRecipientsArray = [];
    var otherRecipientsArray = [];
    var keyRoleRecipients = [];
    var otherRecipients = [];
    if( splitRecipientValues && splitRecipientValues.length > 0 ) {
        _.forEach( splitRecipientValues, function( recipientValue ) {
            if( recipientValue.indexOf( '$' ) > -1 ) {
                keyRoleRecipientsArray.push( recipientValue.trim() );
            } else {
                otherRecipientsArray.push( recipientValue.trim() );
            }
        } );
        keyRoleRecipients = _populateKeyRoleRecipients( data, keyRoleRecipientsArray, dynamicParticipants, internalRecipientValues, dispRecipientValues );
        otherRecipients = _populateOtherRecipients( otherRecipientsArray, internalRecipientValues, dispRecipientValues );
    }
    return {
        propInternalValue: internalRecipientValues,
        propDispValue: dispRecipientValues,
        keyRoleRecipients: keyRoleRecipients,
        otherRecipients: otherRecipients
    };
};


/**
 * Add handler argument row in handler argument table
 * @param {Object} data Data view model object
 * @param {Array} columns Array that is being shown in table
 * @param {Object} selection Selected handler object for handler info needs to be populated
 * @param {String} handlerName Handler name string
 * @param {Array} dynamicParticipants Dynamic participants array
 *
 *
 * @returns {Object} Create VMO object to show handler arguments
 */
export let getHandlerRows = function( data, columns, selection, handlerName, dynamicParticipants ) {
    var argumentRows = [];
    // Check if input handler object don't have properties loaded then no need to process further and
    // return from here
    if( !selection || !selection.props || !selection.props.arguments || !selection.props.arguments.dbValues ) {
        return argumentRows;
    }
    var argumentValues = Awp0WorkflowDesignerUtils.parseHandlerArguments( selection.props.arguments.dbValues );
    var handlerObjectStructure = {
        recipients: { propInternalValue: '', propDispValue: '' },
        subject: { propInternalValue: '', propDispValue: '' },
        notifyWhen: { propInternalValue: '', propDispValue: '' },
        message: { propInternalValue: '', propDispValue: '' },
        includeLabel: { propInternalValue: '', propDispValue: '' }
    };
    handlerObjectStructure.notifyWhen = _populateNotifyWhenColumn( data, selection, handlerName, argumentValues );
    handlerObjectStructure.subject = _populateOtherHandlerArgumentColumn( argumentValues, '-subject' );
    handlerObjectStructure.recipients = _populateRecipientsColumn( data, argumentValues, dynamicParticipants );
    handlerObjectStructure.message = _populateOtherHandlerArgumentColumn( argumentValues, '-comment' );
    handlerObjectStructure.includeLabel = _populateOtherHandlerArgumentColumn( argumentValues, '-attachment' );

    if( handlerObjectStructure && handlerObjectStructure.recipients ) {
        var vmObject = _addHandlerArgumentRowVMOObject( data, columns, selection, handlerObjectStructure );
        vmObject.handlerObject = selection;
        vmObject.handlerName = handlerName;
        vmObject.keyRoleRecipients = handlerObjectStructure.recipients.keyRoleRecipients;
        vmObject.otherRecipients = handlerObjectStructure.recipients.otherRecipients;
        argumentRows.push( vmObject );
    }
    return argumentRows;
};

/**
 * Update the input data provider based on selection for other handlers
 *
 * @param {Object} data Data view model object
 * @param {Object} selection template object for handler need to be populated
 * @param {Object} dataProvider Data provider object that needs to be updated
 * @param {Array} handlerNames Handler names that need to be populated in action table
 * @param {Array} dynamicParticipants Dynamic participants array that will contain internal name and display name
 * @param {Object} notificationHandlerContext Notification handler context object
 *
 * @returns {Object} Table result object
 */
export let populateNotificationTableData = function( data, selection, dataProvider, handlerNames, dynamicParticipants, notificationHandlerContext ) {
    var argumentRows = [];

    // Iterate for all handler names and populate the data for each handler
    _.forEach( handlerNames, function( handlerName ) {
        var templateObject = clientDataModel.getObject( selection.uid );
        if( handlerName === 'EPM-notify-report' ) {
            templateObject = Awp0WorkflowDesignerUtils.getValidTemplateObject( templateObject, 'EPMPerformSignoffTaskTemplate' );
        }
        // Get the attached handler objects for specifc input handler name
        var actionHandlerArray = Awp0WorkflowDesignerUtils.getActionHandler( templateObject, handlerName );
        // Iterate for all handler obejcts and add the rows for that handler
        _.forEach( actionHandlerArray, function( actionHandler ) {
            var argValues = exports.getHandlerRows( data, data.columnProviders.tableColumnProvider.columns, actionHandler, handlerName, dynamicParticipants );
            argumentRows = argumentRows.concat( argValues );
        } );
    } );

    // Create the table result data and return to dispaly on UI.
    var loadResult = tableDPReqRespHelper.createTableLoadResult( argumentRows );
    loadResult.searchResults = argumentRows;
    loadResult.searchIndex = 0;
    loadResult.totalFound = argumentRows.length;
    const localContext = { ...notificationHandlerContext };
    localContext.loadedVMOObjects = argumentRows;
    localContext.selectedTemplateObject = data.selectedTemplateObject;
    localContext.isTemplateEditable = data.isTemplateEditable;
    localContext.rootTaskTemplateObject = data.rootTaskTemplateObject;
    localContext.selectedObjects = [];
    loadResult.notificationHandlerContext = localContext;
    dataProvider.update( argumentRows, argumentRows.length );
    return {
        tableResult: loadResult,
        notificationHandlerContext : localContext
    };
};

/**
 * Get all template objects that need to be loaded so that information will be seen
 * correctly.
 * @param {Object} selection template object for handler need to be populated
 *
 * @returns {Array} Template objects that need to be loaded
 */
export let getTemplateObjectsToLoad = function( selection ) {
    var selectedObjects = [];
    // Check for input selected is not valid then no need to process further and return
    if( !selection || !selection.uid ) {
        return selectedObjects;
    }
    // Get the template object obejct from client data model and use it to get the proper handlers
    var templateObject = clientDataModel.getObject( selection.uid );
    if( !templateObject ) {
        return selectedObjects;
    }
    var modelObject = Awp0WorkflowDesignerUtils.getValidTemplateObject( templateObject, 'EPMPerformSignoffTaskTemplate' );
    if( modelObject ) {
        selectedObjects.push( modelObject );
    }
    selectedObjects.push( templateObject );
    return selectedObjects;
};


/**
 * Check when user is selecting any row in notification table and Add or show panel is open then close the panel
 * @param {Object} ctx Context object to check if panel is already open or not
 * @param {Array} selectedRows Selected rows from UI notification table
 * @param {Object} notificationHandlerContext Handler context object that stores context info.
 *
 * @returns {Object} Updated notification handler context object
 */
export let notificationHandlerRowSelection = function( ctx, selectedRows, notificationHandlerContext ) {
    if( ctx.activeToolsAndInfoCommand && (
        ctx.activeToolsAndInfoCommand.commandId === 'Awp0WorkflowAddNotificationHandler'
        || ctx.activeToolsAndInfoCommand.commandId === 'Awp0WorkflowShowNotificationHandler'
        || ctx.activeToolsAndInfoCommand.commandId === 'Awp0WorkflowEditNotificationHandler' ) ) {
        eventBus.publish( 'closePanel' );
    }
    const localContext = { ...notificationHandlerContext };
    localContext.selectedObjects = selectedRows;
    return localContext;
};

export default exports = {
    getHandlerRows,
    populateNotificationTableData,
    getTemplateObjectsToLoad,
    notificationHandlerRowSelection
};
