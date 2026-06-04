// Copyright (c) 2022 Siemens

/**
 * This implements the workflow template notifications related methods.
 *
 * @module js/Awp0WorkflowTemplateNotificationPanelService
 */
import appCtxService from 'js/appCtxService';
import Awp0WorkflowDesignerUtils from 'js/Awp0WorkflowDesignerUtils';
import viewModelObjectSvc from 'js/viewModelObjectService';
import _ from 'lodash';

var exports = {};

const COMMENT_HANDLER_ARGUMENT = '-comment';
const SUBJECT_HANDLER_ARGUMENT = '-subject';
const ATTACHMENT_HANDLER_ARGUMENT = '-attachment';
const REPORT_HANDLER_ARGUMENT = '-report';
const RECIPIENT_HANDLER_ARGUMENT = '-recipient';
const LATE_NOTIFICATION_HANDLER = 'EPM-late-notification';
const EPM_NOTIFY_REPORT_HANDLER = 'EPM-notify-report';
const EPM_NOTIFY_HANDLER = 'EPM-notify';

/**
 * Check if input object is not null and if type of Group Member then get the user
 * from group member and add into data provider else directly add to data provider.
 *
 * @param {Object} data Data view model object
 * @param {Object} dataProvider data provider where object need to be added
 * @param {Object} handlerContextObject Selected handler context object that will contian all recipient options
 * @param {boolean} isTemplateEditable True/False based on template is in edit mode or not.
 */
var _populateExistingDataProvider = function( data, dataProvider, handlerContextObject, isTemplateEditable ) {
    var handlerRecipients = [];
    // Check if handlerContextObject i snot null that means user has selected some handler from table
    // and user is trying to bring up the information panel then populate those recipients on panel
    if( handlerContextObject ) {
        var keyRoleObjects = Awp0WorkflowDesignerUtils.createKeyRoleObjects( handlerContextObject.keyRoleRecipients, false, data.i18n.any );
        Array.prototype.push.apply( handlerRecipients, keyRoleObjects );
        var otherObjects = Awp0WorkflowDesignerUtils.createKeyRoleObjects( handlerContextObject.otherRecipients, false, data.i18n.any );
        Array.prototype.push.apply( handlerRecipients, otherObjects );
    }
    // Iterate for all recipients and then if it's not place holder and panel
    // is in edit mode then set the canRemove to true so user can modify the recipients
    _.forEach( handlerRecipients, function( recipient ) {
        if( !recipient.isPlaceHolder ) {
            recipient.canRemove = isTemplateEditable;
        }
    } );
    // Update the data provider with recipients
    dataProvider.update( handlerRecipients, handlerRecipients.length );
};

/**
 * Check if selected template is review, route, acknowledge , PS task or not and based on that return true or false
 * @param {Object} selectedObject Selected template object from graph
 *
 * @returns {boolean} True/false
 */
var _isReviewAckRouteOrPSTaskTemplateSelected = function( selectedObject ) {
    var isReviewAckRouteTaskSelected = false;
    // Check if input is not null and is one of these types then only return true
    if( selectedObject && selectedObject.modelType && ( selectedObject.modelType.typeHierarchyArray.indexOf( 'EPMReviewTaskTemplate' ) > -1 || selectedObject.modelType.typeHierarchyArray.indexOf( 'EPMAcknowledgeTaskTemplate' ) > -1 ||
            selectedObject.modelType.typeHierarchyArray.indexOf( 'EPMRouteTaskTemplate' ) > -1 || selectedObject.modelType.typeHierarchyArray.indexOf( 'EPMPerformSignoffTaskTemplate' ) > -1 ) ) {
        isReviewAckRouteTaskSelected = true;
    }
    return isReviewAckRouteTaskSelected;
};

/**
 * Return an empty ListModel object.
 *
 * @return {Object} - Empty ListModel object.
 */
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

/**
 * Get the  notify option based on task selection to be selected.
 * @param {Object} data Data view model object
 * @param {boolean} isReviewACKRoutePSTaskSelected True or false based on task is multi user task or not
 *
 * @returns {String} Returns the notify when option to be selected by default.
 */
var _getDefaultNotifyWhenOption = function( data, isReviewACKRoutePSTaskSelected ) {
    if( isReviewACKRoutePSTaskSelected && data.reviewNotifyWhenValues && data.reviewNotifyWhenValues[ 0 ] ) {
        return data.reviewNotifyWhenValues[ 0 ];
    } else if( !isReviewACKRoutePSTaskSelected && data.taskNotifyWhenValues && data.taskNotifyWhenValues[ 0 ] ) {
        return data.taskNotifyWhenValues[ 0 ];
    }
    return null;
};

/**
 * Get the handler name based on task selection and selected notify option.
 * @param {boolean} isReviewACKRoutePSTaskSelected True or false based on task is multi user task or not
 * @param {String} notifyOption Selected notify when option
 *
 * @returns {String} Returns the handler name based on task and selected option.
 */
var _getHandlerNameBasedOnNotifyOption = function( isReviewACKRoutePSTaskSelected, notifyOption ) {
    var handlerName = null;
    // Check if value is true then get the notify when value from review list and if option is review, progrees, level, rejection then we need
    // to use EPM-notify-report handler.
    // If value is EPM-late-notification then we need to create EPM-late-notification and in all other case we need to create EPM-notify handler
    if( isReviewACKRoutePSTaskSelected && ( notifyOption === 'review' || notifyOption === 'rejection' || notifyOption === 'progress' || notifyOption === 'level' ) ) {
        handlerName = EPM_NOTIFY_REPORT_HANDLER;
    } else if( notifyOption === LATE_NOTIFICATION_HANDLER ) {
        handlerName = LATE_NOTIFICATION_HANDLER;
    } else {
        handlerName = EPM_NOTIFY_HANDLER;
    }
    return handlerName;
};

/**
 * Populate the panel otpions based on handler selection. If handler is selected then only process further
 * to show the values based on selected handler
 * @param {Object} data Data view model object
 * @param {Object} templateObject Template object for handler info need to be shown
 * @param {Object} handlerContextObject Selected handler context object that will contian all recipient options
 * @param {boolean} isEditable True or false based on panel is editable or not.
 *
 * @returns {Object} Updated UI props that need to be rendered on UI
 */
var _populateHandlerOptions = function( data, templateObject, handlerContextObject, isEditable ) {
    var isReviewACKRoutePSTaskSelected = false;
    // Check if review, acknowledge or route task selected so for that we need to show different
    // options. So set the boolean to true
    if( _isReviewAckRouteOrPSTaskTemplateSelected( templateObject ) ) {
        isReviewACKRoutePSTaskSelected = true;
    }

    const localTaskNotifyWhenList = { ...data.taskNotifyWhenList };
    const localReviewNotifyWhenList = { ...data.reviewNotifyWhenList };

    // Check if selected template is isReviewACKRoutePSTaskSelected then use the review notify when
    // UI value else use task notify when value
    var notifyWhenUIProp = localTaskNotifyWhenList;
    if( isReviewACKRoutePSTaskSelected ) {
        notifyWhenUIProp = localReviewNotifyWhenList;
    }

    var selectedNotifyWhenOption = null;
    var handlerName = null;
    // Get the default notify when option as this will be used in add case.
    var defaultOption = _getDefaultNotifyWhenOption( data, isReviewACKRoutePSTaskSelected );
    if( defaultOption ) {
        notifyWhenUIProp.dbValue = defaultOption.propInternalValue;
        notifyWhenUIProp.uiValue = defaultOption.propDisplayValue;
        selectedNotifyWhenOption = defaultOption.propInternalValue;
        // Get the specific handler name absed on default notify option
        handlerName = _getHandlerNameBasedOnNotifyOption( isReviewACKRoutePSTaskSelected, selectedNotifyWhenOption );
    }

    // Set the notify when option value based on select handler object and set the edit state
    if( handlerContextObject && handlerContextObject.props.notifyWhen && handlerContextObject.props.notifyWhen.dbValue &&
        handlerContextObject.props.notifyWhen.uiValue ) {
        notifyWhenUIProp.dbValue = handlerContextObject.props.notifyWhen.dbValue;
        notifyWhenUIProp.uiValue = handlerContextObject.props.notifyWhen.uiValue;
        selectedNotifyWhenOption = handlerContextObject.props.notifyWhen.dbValue;
    }

    notifyWhenUIProp.isEditable = isEditable;
    const localNotifySubject = { ...data.notifySubject };
    localNotifySubject.isEditable = isEditable;

    const localNotifyMessage = { ...data.notifyMessage };
    localNotifyMessage.isEditable = isEditable;

    var argumentValues = null;

    const localProcessInfo = { ...data.processInfo };
    const localTargetInfo = { ...data.targetInfo };
    const localReferenceInfo = { ...data.referenceInfo };

    // Check if we are edit handler case then we need to check if handler present and if yes
    // then show the correct values on UI based on handler arguments
    if( handlerContextObject && handlerContextObject.handlerObject ) {
        handlerName =  handlerContextObject.handlerName;

        // Setting the value also on radio widgets to handle the case if dbValue is false then clicking on first time
        // was not seeting the value correctly. So to handle that case, setting the value as well so on property layer
        // proeprty dbValue, value and newvalue comparision works fine and shows the value checkes correctly.
        localProcessInfo.dbValue = false;
        localProcessInfo.value = false;
        localTargetInfo.dbValue = false;
        localTargetInfo.value = false;
        localReferenceInfo.dbValue = false;
        localReferenceInfo.value = false;

        // Get all handler arguemnts from handler object and based on values update the UI.
        argumentValues = Awp0WorkflowDesignerUtils.parseHandlerArguments( handlerContextObject.handlerObject.props.arguments.dbValues );
    }

    if( argumentValues ) {
        // Check if comment arguemnt present then set the message value
        if( argumentValues[ COMMENT_HANDLER_ARGUMENT ] ) {
            localNotifyMessage.dbValue = argumentValues[ COMMENT_HANDLER_ARGUMENT ];
            localNotifyMessage.uiValue = argumentValues[ COMMENT_HANDLER_ARGUMENT ];
        }
        // Check if subject arguemnt present then set the subject value
        if( argumentValues[ SUBJECT_HANDLER_ARGUMENT ] ) {
            localNotifySubject.dbValue = argumentValues[ SUBJECT_HANDLER_ARGUMENT ];
            localNotifySubject.uiValue = argumentValues[ SUBJECT_HANDLER_ARGUMENT ];
        }
        // If attachmetn option present then based on present values on UI set the values
        if( argumentValues[ ATTACHMENT_HANDLER_ARGUMENT ] ) {
            var attachmentValue = argumentValues[ ATTACHMENT_HANDLER_ARGUMENT ];
            if( attachmentValue.indexOf( 'process' ) > -1 ) {
                localProcessInfo.dbValue = true;
                localProcessInfo.value = true;
            }
            if( attachmentValue.indexOf( 'target' ) > -1 ) {
                localTargetInfo.dbValue = true;
                localTargetInfo.value = true;
            }
            if( attachmentValue.indexOf( 'reference' ) > -1 ) {
                localReferenceInfo.dbValue = true;
                localReferenceInfo.value = true;
            }
        }
    }
    return {
        isPanelEditable : isEditable,
        isReviewACKRoutePSTaskSelected : isReviewACKRoutePSTaskSelected,
        taskNotifyWhenList : localTaskNotifyWhenList,
        reviewNotifyWhenList : localReviewNotifyWhenList,
        notifyMessage : localNotifyMessage,
        notifySubject : localNotifySubject,
        processInfo : localProcessInfo,
        targetInfo : localTargetInfo,
        referenceInfo : localReferenceInfo,
        selectedNotifyWhenOption : selectedNotifyWhenOption,
        handlerName : handlerName
    };
};

/**
 * Populate the panel with all relevant information that need to be shown.
 * @param {Object} data Data view model object
 * @param {Object} rootTaskTemplateObject Root task template object
 * @param {Object} templateObject Task template object for handler info need to be added or updated
 * @param {Object} handlerContextObject Handler context object if we are trying to update handler
 * @param {Object} workflowDgmEditCtx Workflow diagram edit context that hold all editable tempaltes
 *
 * @returns {Object} Object with all updated widget and other info
 */
export let populatePanelData = function( data, rootTaskTemplateObject, templateObject, handlerContextObject, workflowDgmEditCtx ) {
    // Get the tempalte is in edit mode or not and based on that populate the panel.
    var isPanelEditable = false;
    if( rootTaskTemplateObject && workflowDgmEditCtx && workflowDgmEditCtx.editObjectUids
         && workflowDgmEditCtx.editObjectUids.indexOf( rootTaskTemplateObject.uid ) > -1 ) {
        isPanelEditable = true;
    }
    // Populate the receipient data provider and other UI widgets
    _populateExistingDataProvider( data, data.dataProviders.recipientsDataProvider, handlerContextObject, isPanelEditable );
    return _populateHandlerOptions( data, templateObject, handlerContextObject, isPanelEditable );
};

/**
 * Remove the input object from recipient list
 * @param {Object} selectedObject Selected object that need to be removed from recipient list
 * @param {Object} dataProvider Data provider from where object need to be removed
 *
 * @returns {boolean} True/False based on data provider contains more than 1 object or not
 */
export let removeKeyRoleArguments = function( selectedObject, dataProvider ) {
    var isValidToModify = false;
    var modelObjects = dataProvider.viewModelCollection.loadedVMObjects;
    var validObjects = _.difference( modelObjects, [ selectedObject ] );
    // Check if valid objects are minimum 1 then only we need to enable isValidToModify to true
    // so that add button will be enabled. One recipient is must
    if( validObjects && !_.isEmpty( validObjects ) ) {
        isValidToModify = true;
    }
    dataProvider.update( validObjects, validObjects.length );
    return isValidToModify;
};

/**
 * Update the handler name based on selected notify when option value.
 *
 * @param {Object} data Data view model object
 * @param {boolean} isReviewTaskTemplate Slected template is review, route, ack or PS task or not
 * @param {Object} selectedOption Selected option value from UI widget
 *
 * @returns {Object} Handler name that need to be created or updated along with updated UI widgets
 */
export let notifyWhenOptionChange = function( data, isReviewTaskTemplate, selectedOption ) {
    var handlerName = data.handlerName;

    // Get the specific handler name absed on  notify option
    handlerName = _getHandlerNameBasedOnNotifyOption( isReviewTaskTemplate, selectedOption );

    const notifySubject = { ...data.notifySubject };
    const notifyMessage = { ...data.notifyMessage };
    // Clear the subject and message for late notification handler
    if( handlerName === LATE_NOTIFICATION_HANDLER ) {
        notifySubject.dbValue = '';
        notifySubject.uiValue = '';
        notifyMessage.dbValue = '';
        notifyMessage.uiValue = '';
    }

    return {
        handlerName : handlerName,
        notifySubject : notifySubject,
        notifyMessage : notifyMessage
    };
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
 * This method check if both input objects are resource pool object then only it will return
 * true else it will return false.
 * @param {Object} objectA First input object
 * @param {Object} objectB Second input object
 * @returns {boolean} True/False
 */
var _isDuplicateResourcePoolObjects = function( objectA, objectB ) {
    if( isOfType( objectA, 'ResourcePool' ) && isOfType( objectB, 'ResourcePool' ) ) {
        return true;
    }
    return false;
};

/**
 * Check if input object is not null and if type of Group Member then get the user
 * from group member and add into data provider else directly add to data provider.
 *
 * @param {Object} dataProvider data provider where object need to be added
 * @param {Array} selectedObjects Object that need to be added
 * @param {boolean} mergeData To provide support that we want to add to existing
 *                  elements on data or replace
 */
var _populateDataProvider = function( dataProvider, selectedObjects, mergeData ) {
    var assignerUsers = [];
    _.forEach( selectedObjects, function( selectedObject ) {
        if( isOfType( selectedObject, 'GroupMember' ) ) {
            var userObject = viewModelObjectSvc.createViewModelObject( selectedObject.props.user.dbValues[ 0 ] );
            if( userObject ) {
                userObject.selected = false;
                assignerUsers.push( userObject );
                userObject.canRemove = true;
            }
        } else {
            if( selectedObject ) {
                selectedObject.selected = false;
                selectedObject.canRemove = true;
                assignerUsers.push( selectedObject );
            }
        }
    } );

    // Check if merge daya is true then get already present element in data provider
    // and add it to new model objects and update data provider
    if( mergeData ) {
        var presetObjects = dataProvider.vmCollectionObj.vmCollection.loadedVMObjects;
        Array.prototype.push.apply( presetObjects, assignerUsers );

        // Remove the duplicates if present in presetObjects list. If duplicate resource pool
        // present then it should not filter it out.
        assignerUsers = _.uniqWith( presetObjects, function( objA, objB ) {
            return objA.uid === objB.uid && !_isDuplicateResourcePoolObjects( objA, objB );
        } );
    }
    dataProvider.update( assignerUsers, assignerUsers.length );
};

/**
 * Add the selected obejct from user picker panel to main panel.
 * @param {Array} selectedObjects Selected objects that need to be added
 * @param {Object} dataProvider Data provider object
 *
 * @return {boolean} True after adding the objects to data provider
 */
export let addSelectedUsers = function( selectedObjects, dataProvider ) {
    _populateDataProvider( dataProvider, selectedObjects, true );
    return true;
};

/**
 * Get the recipient handler arguemtn values based on obejct present on UI in comamnd seperated string
 * @param {Object} dataProvider data provider where recipients are added
 * @param {String} handlerName Handler name which is being created
 * @returns {String} Recipient arguemtn value
 */
var _getHandlerArgumentValue = function( dataProvider, handlerName ) {
    var argumentValue = '';
    var assigness = [];
    var loadedObjects = dataProvider.viewModelCollection.loadedVMObjects;
    _.forEach( loadedObjects, function( loadedObject ) {
        if( isOfType( loadedObject, 'User' ) ) {
            // Check if handler that need to be create is late notification and selected object is user then
            // we will not append anything before that and for other handler we need to append 'user:'
            if( handlerName === LATE_NOTIFICATION_HANDLER ) {
                assigness.push( loadedObject.props.user_id.dbValue );
            } else {
                assigness.push( 'user:' + loadedObject.props.user_id.dbValue );
            }
        } else if( isOfType( loadedObject, 'ResourcePool' ) ) {
            // For resource pool object we need to add group and role name with prefix 'resourcepool:'
            var groupObject = Awp0WorkflowDesignerUtils.getGroupObject( loadedObject, '*' );
            var roleObject = Awp0WorkflowDesignerUtils.getRoleObject( loadedObject, '*' );
            if( groupObject && roleObject && groupObject.groupInternalName && roleObject.roleInternalName ) {
                assigness.push( 'resourcepool:' + groupObject.groupInternalName + '::' + roleObject.roleInternalName );
            }
        } else if( loadedObject.type === 'KeyRole' && !loadedObject.isPlaceHolder ) {
            // For key role directly use the key role dbvalue
            var keyRoleValue = loadedObject.props.keyRole.dbValue;
            if( loadedObject !== '' ) {
                assigness.push( keyRoleValue );
            }
        }
    } );
    argumentValue = assigness.join();
    return argumentValue;
};

/**
 * Return the action type value based on user selected option from UI.
 * @param {Object} data Data view model object
 * @param {String} handlerName Handler name which is being created
 *
 * @returns {String} Action type value
 */
var _getNotyHandlerActionType = function( data, handlerName ) {
    var actionType = 2;
    // If handler is EPM notify then get the action type selected value and return that value
    if( handlerName === EPM_NOTIFY_HANDLER && !data.isReviewACKRoutePSTaskSelected ) {
        actionType = data.taskNotifyWhenList.dbValue;
    } else {
        // In case of notify report handler based on selected option return the action type
        var reviewOption = data.reviewNotifyWhenList.dbValue;
        if( reviewOption === 'review' ) {
            actionType = 2;
        } else if( reviewOption === 'rejection' ) {
            actionType = 100;
        } else if( reviewOption === 'progress' ) {
            actionType = 4;
        } else if( reviewOption === 'level' ) {
            actionType = 4;
        } else {
            actionType = reviewOption;
        }
    }
    // Check if action type is string then we need to convert it to int value before
    // calling the SOA to create or update handler
    if( _.isString( actionType ) ) {
        actionType = _.parseInt( actionType );
    }
    return actionType;
};

/**
 * Return the attachment type option value based on user selected option from UI.
 * @param {Object} data Data view model object
 * @param {String} handlerName Handler name which is being created
 *
 * @returns {String} Attachment option value
 */
var _getNotifyAttachmentType = function( data, handlerName ) {
    var attachmentOption = null;
    var attachmentTypes = [];
    // Check if handler name is late notification then we can't set attachemtn on that handler so return null.
    // For other notify handler get attachment options based on user selection and and return it
    if( handlerName === LATE_NOTIFICATION_HANDLER ) {
        return attachmentOption;
    }
    if( data.processInfo.dbValue ) {
        attachmentTypes.push( 'process' );
    }
    if( data.targetInfo.dbValue ) {
        attachmentTypes.push( 'target' );
    }
    if( data.referenceInfo.dbValue ) {
        attachmentTypes.push( 'reference' );
    }
    // Combine all attachment types as one single string seperated by ','
    if( attachmentTypes && attachmentTypes.length > 0 ) {
        attachmentOption = attachmentTypes.join();
    } else {
        attachmentOption = '';
    }
    return attachmentOption;
};

/**
 * Based on handler name and return the template uid where handler need to be created.
 * If selected handler is EPM-notify-report that means we need to add the handler on PS task and not
 * on selected task.
 * @param {Object} selected Selected template object from UI
 * @param {String} handlerName Handler name which is being created
 *
 * @returns {String} Valid template Uid where handler will be created
 */
var _getTemplateObejctTypeUid = function( selected, handlerName ) {
    if( handlerName === EPM_NOTIFY_REPORT_HANDLER ) {
        var modelObject = Awp0WorkflowDesignerUtils.getValidTemplateObject( selected, 'EPMPerformSignoffTaskTemplate' );
        if( modelObject ) {
            return modelObject.uid;
        }
    }
    return selected.uid;
};

/**
 * Return the report option value based on user selected option from UI.
 * @param {Object} data Data view model object
 * @param {String} handlerName Handler name which is being created
 *
 * @returns {String} Report option value
 */
var _getNotifyReportOption = function( data, handlerName ) {
    var reportOption = null;
    if( handlerName === EPM_NOTIFY_REPORT_HANDLER ) {
        reportOption = data.reviewNotifyWhenList.dbValue;
    }
    return reportOption;
};

/**
 * Check if handler update case where handler need to be deleted and new handler need to be created
 * @param {Object} data Data view model object
 * @param {Object} handlerContextObject If user selected any handler form notification table then contian that
 *                 handler object else null
 * @param {int} newActionType New action type value to be match
 * @returns {boolean} isCreateCase True/ false based on user action for create or update handler
 */
var _isHandlerDeleteAndCreateCase = function( data, handlerContextObject, newActionType ) {
    // Check if selected handler action type is differnt then selected action value from UI
    // then we need this handler to be deleted and new handler will be created
    if( handlerContextObject && ( data.handlerName !== handlerContextObject.handlerName ||
            handlerContextObject.props.parent_action_type &&
            handlerContextObject.props.parent_action_type.dbValue !== newActionType ) ) {
        return true;
    }
    return false;
};

/**
 * Create the input structure for notification handler for EPM-notify and EPM-notify-report.
 * @param {Object} data Data view model object
 * @param {Object} dataProvider Data provider objects that will contain all recipients values
 * @param {Object} selected Selected template object from UI
 * @param {Object} handlerContextObject If user selected any handler form notification table then contian that
 *                 handler object else null
 * @param {Object} subPanelContext Sub panel context object
 * @param {boolean} isCreateCase True/ false based on user action for create or update handler
 *
 * @returns {Array} Create or update handler SOA input structure array
 */
var _getUpdateOrCreateNotyHandlerInput = function( data, dataProvider, selected, handlerContextObject, subPanelContext, isCreateCase ) {
    var input = [];
    // Get the differnt arguemnts that we need to set on handler based on handler name
    var recipientValue = _getHandlerArgumentValue( dataProvider, data.handlerName );
    if( appCtxService.ctx.preferences.EPM_ARG_target_user_group_list_separator && appCtxService.ctx.preferences.EPM_ARG_target_user_group_list_separator.length > 0 && appCtxService.ctx.preferences.EPM_ARG_target_user_group_list_separator[0].trim() !== '' ) {
        recipientValue = recipientValue.replace( /,/g, appCtxService.ctx.preferences.EPM_ARG_target_user_group_list_separator[0] );
    }
    var actionType = _getNotyHandlerActionType( data, data.handlerName );
    var attachmentType = _getNotifyAttachmentType( data, data.handlerName );
    var report = _getNotifyReportOption( data, data.handlerName );
    var additionalDataMap = {};

    // Check if subject is valid then add it to additional data to set on handler
    if( data.notifySubject.dbValue ) {
        additionalDataMap[ SUBJECT_HANDLER_ARGUMENT ] = [ data.notifySubject.dbValue ];
    }

    // Check if message is valid then add it to additional data to set on handler
    if( data.notifyMessage.dbValue ) {
        //As a fix for the defect LCS-380726. replacing newline character with space.
        data.notifyMessage.dbValue = data.notifyMessage.dbValue.replace( /\n/g, ' ' );
        additionalDataMap[ COMMENT_HANDLER_ARGUMENT ] = [ data.notifyMessage.dbValue ];
    }

    // Check if attachment type is not null then set the value on aaditional data to set on handler
    if( attachmentType || attachmentType === '' ) {
        additionalDataMap[ ATTACHMENT_HANDLER_ARGUMENT ] = [ attachmentType ];
    }

    // Check if report is not null then set the value on aaditional data to set on handler
    if( report ) {
        additionalDataMap[ REPORT_HANDLER_ARGUMENT ] = [ report ];
    }
    if( recipientValue && !_.isEmpty( recipientValue ) ) {
        additionalDataMap[ RECIPIENT_HANDLER_ARGUMENT ] = [ recipientValue ];
    }

    // Check if selected handler action type is differnt then selected action value from UI
    // then we need this handler to be deleted and new handler will be created
    var isDeleteAndCreateCase = _isHandlerDeleteAndCreateCase( data, handlerContextObject, actionType );
    if( subPanelContext && handlerContextObject && isDeleteAndCreateCase ) {
        // Updating handlerContextObject with delete handler UID so that SOA can be called
        // to delete the handler as new handler will be created and selected need to be removed.
        const localContext = { ...subPanelContext };
        localContext.handlerContextObject.deleteHandlerUid = handlerContextObject.uid;
        subPanelContext.update && subPanelContext.update( localContext );
        isCreateCase = true;
    }
    // Check if handler context is not null that means it's update handler case
    // otherwise it will be create handler case
    if( handlerContextObject && !isCreateCase ) {
        // Update the addiitonal data if handler has some other arguemtns defiend. This is needed
        // as server replace the all arguemnts from handler based on passed arguments.
        Awp0WorkflowDesignerUtils.updateAdditionalDataWithOtherArguments( handlerContextObject, additionalDataMap );

        // Check if subject or comment values are now empty and previously it used to have soem value then remove
        // these values from handler arguments. FIx for defect # LCS-420569
        if( data.notifySubject.valueUpdated && data.notifySubject.dbValue === '' && additionalDataMap.hasOwnProperty( SUBJECT_HANDLER_ARGUMENT ) ) {
            delete additionalDataMap[ SUBJECT_HANDLER_ARGUMENT ];
        }
        if( data.notifyMessage.valueUpdated && data.notifyMessage.dbValue === '' && additionalDataMap.hasOwnProperty( COMMENT_HANDLER_ARGUMENT ) ) {
            delete additionalDataMap[ COMMENT_HANDLER_ARGUMENT ];
        }
        var updateObject = {
            clientID: 'updateHandler -' + handlerContextObject.uid,
            handlerName: data.handlerName,
            handlerToUpdate: handlerContextObject.uid,
            additionalData: additionalDataMap
        };
        input.push( updateObject );
    } else {
        var createObject = {
            clientID: 'createHandler -' + selected.uid,
            handlerName: data.handlerName,
            taskTemplate: _getTemplateObejctTypeUid( selected, data.handlerName ),
            handlerType: 'Action',
            action: actionType,
            additionalData: additionalDataMap
        };
        input.push( createObject );
    }
    return input;
};

/**
 * Create the input structure for late notification handler
 * @param {Object} data Data view model object
 * @param {Object} dataProvider Data provider objects that will contain all recipients values
 * @param {Object} selected Selected template object from UI
 * @param {Object} handlerContextObject If user selected any handler form notification table then contian that
 *                 handler object else null
 * @param {Object} subPanelContext Sub panel context object
 * @param {boolean} isCreateCase True/ false based on user action for create or update handler
 *
 * @returns {Array} Create or update handler SOA input structure array
 */
var _getUpdateOrCreateLateNotyHandlerInput = function( data, dataProvider, selected, handlerContextObject, subPanelContext, isCreateCase ) {
    var input = [];
    var argumentValue = _getHandlerArgumentValue( dataProvider, LATE_NOTIFICATION_HANDLER );
    if( appCtxService.ctx.preferences.EPM_ARG_target_user_group_list_separator && appCtxService.ctx.preferences.EPM_ARG_target_user_group_list_separator.length > 0 && appCtxService.ctx.preferences.EPM_ARG_target_user_group_list_separator[0].trim() !== '' ) {
        argumentValue = argumentValue.replace( /,/g, appCtxService.ctx.preferences.EPM_ARG_target_user_group_list_separator[0] );
    }

    // Check if selected handler action type is differnt then selected action value from UI
    // then we need this handler to be deleted and new handler will be created
    var isDeleteAndCreateCase = _isHandlerDeleteAndCreateCase( data, handlerContextObject, 2 );
    if( subPanelContext && handlerContextObject && isDeleteAndCreateCase && handlerContextObject.handlerName !== LATE_NOTIFICATION_HANDLER ) {
        // Updating handlerContextObject with delete handler UID so that SOA can be called
        // to delete the handler as new handler will be created and selected need to be removed.
        const localContext = { ...subPanelContext };
        localContext.handlerContextObject.deleteHandlerUid = handlerContextObject.uid;
        subPanelContext.update && subPanelContext.update( localContext );
        isCreateCase = true;
    }

    // Check if handler context is not null that means it's update handler case
    // otherwise it will be create handler case
    if( handlerContextObject && !isCreateCase ) {
        var updateAdditionalData = {};
        updateAdditionalData[ RECIPIENT_HANDLER_ARGUMENT ] = [ argumentValue ];
        var updateObject = {
            clientID: 'updateHandler -' + handlerContextObject.uid,
            handlerToUpdate: handlerContextObject.uid,
            additionalData: updateAdditionalData
        };
        input.push( updateObject );
    } else {
        var createAdditionalData = {};
        createAdditionalData[ RECIPIENT_HANDLER_ARGUMENT ] = [ argumentValue ];
        var createObject = {
            clientID: 'createHandler -' + selected.uid,
            handlerName: LATE_NOTIFICATION_HANDLER,
            taskTemplate: selected.uid,
            handlerType: 'Action',
            action: 2,
            additionalData: createAdditionalData
        };
        input.push( createObject );
    }
    return input;
};

/**
 * Create the create or update handler input based on user action and return the input structure.
 *
 * @param {Object} data Data view model object
 * @param {Object} selected Selected template object from UI
 * @param {Object} selectedHandlerContext If user selected any handler form notification table then contian that
 *                 handler object else null
 * @param {Object} subPanelContext Sub panel context object
 * @param {boolean} isCreateCase True/ false based on user action for create or update handler
 *
 * @returns {Array} Create or update handler SOA input structure array
 */
export let getCreateOrUpdateHandlerInput = function( data, selected, selectedHandlerContext, subPanelContext, isCreateCase ) {
    var input = [];
    // Check if handler name is EPM-late-notification then call below method and for other handlers
    // call different method
    if( data.handlerName === LATE_NOTIFICATION_HANDLER ) {
        input = _getUpdateOrCreateLateNotyHandlerInput( data, data.dataProviders.recipientsDataProvider, selected, selectedHandlerContext, subPanelContext, isCreateCase );
    } else {
        input = _getUpdateOrCreateNotyHandlerInput( data, data.dataProviders.recipientsDataProvider, selected, selectedHandlerContext, subPanelContext, isCreateCase );
    }
    return input;
};

export default exports = {
    populatePanelData,
    removeKeyRoleArguments,
    notifyWhenOptionChange,
    addSelectedUsers,
    getCreateOrUpdateHandlerInput
};
