// Copyright (c) 2022 Siemens

/**
 * Service that provides APIs for Notification\Subscription use cases.
 *
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Saw1NotificationService
 */
import appCtxService from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import dms from 'soa/dataManagementService';
import eventBus from 'js/eventBus';
import preferenceSvc from 'soa/preferenceService';
import saw1SubSummarySvc from 'js/Saw1SubscriptionSummaryNotificationService';
import saw1PeoplePickerUtils from 'js/Saw1PeoplePickerUtils';
import _ from 'lodash';

var exports = {};

var EXTRA_ARG_EMAIL_SUBJECT = 'email_subject';
var EXTRA_ARG_EMAIL_TEXT  = 'email_message';
var EXTRA_ARG_EMAIL_RECIPIENTS = 'email_recipients';
var EXTRA_CONDITIONS = 'condition';

/**
 * Its generic function to get Display value from array property of view model data.
 *
 * @param arrayData : Array property data
 * @param internalValueToCheck: Value to check
 * @return propDisplayValue - Display value
 */
var getDisplayValue = function( arrayData, internalValueToCheck ) {
    let propDisplayValue = '';
    for ( let i = 0; i < arrayData.length; i++ ) {
        if ( arrayData[i].propInternalValue === internalValueToCheck ) {
            propDisplayValue = arrayData[i].propDisplayValue;
            break;
        }
    }
    return propDisplayValue;
};

/**
 * Its generic function to get Index of data in Array daya.
 *
 * @param arrayData : Array property data
 * @param internalValueToCheck: Value to check
 * @return indexOfEntry -Inxex of value
 */
var getIndexOfEntryFromArrayData = function( arrayData, internalValueToCheck ) {
    let indexOfEntry = -1;
    for ( let i = 0; i < arrayData.length; i++ ) {
        if ( arrayData[i].propInternalValue === internalValueToCheck ) {
            indexOfEntry = i;
            break;
        }
    }
    return indexOfEntry;
};

/**
 * Its generic function to get value at given index.
 *
 * @param arrayData : Array property data
 * @param index:Inxed from value needs to be returned
 * @return valueAtIndex -property data at an Index.
 */
var getValueAtIndexFromArrayData = function( arrayData, index ) {
    let valueAtIndex = '';
    for ( let i = 0; i < arrayData.length; i++ ) {
        if ( index === i ) {
            valueAtIndex = arrayData[i];
            break;
        }
    }
    return valueAtIndex;
};

/**
 * Initialize panel data such as event list , create use case or edit use case.
 *
 * @param {object} data - The CreateNotification view model data
*/
export let initializePanelData = function( data, panelContext ) {
    let panelData = {};
    if ( data.isPanelInitialized === false ) {
        let selectedObj = appCtxService.getCtx( 'mselected' );
        if ( selectedObj.length ) {
            if ( selectedObj[0].modelType.typeHierarchyArray.indexOf( 'ScheduleTask' ) > -1 ) {
                panelData.eventTypeNames = data.eventTypeNamesTask;
            }
            if ( selectedObj[0].modelType.typeHierarchyArray.indexOf( 'Schedule' ) > -1 ) {
                panelData.eventTypeNames = data.eventTypeNamesSchedule;
            }
        }

        let isCreateUseCase = true;
        let subscriptionVMOToUpdate = null;
        if ( panelContext && panelContext.subscriptionVMOToUpdate ) {
            isCreateUseCase = false;
            subscriptionVMOToUpdate = panelContext.subscriptionVMOToUpdate;
        }

        panelData.isCreateUseCase = isCreateUseCase;
        panelData.isPanelInitialized = true;
        panelData.subscriptionVMOToUpdate = subscriptionVMOToUpdate;
    } else {
        panelData.eventTypeNames = data.eventTypeNames;
        panelData.isCreateUseCase = data.isCreateUseCase;
        panelData.isPanelInitialized = data.isPanelInitialized;
        panelData.subscriptionVMOToUpdate = data.subscriptionVMOToUpdate;
    }
    return panelData;
};

/**
 * Update Panel data based on selected object or localization from server.
 *
 * @param {object} data - The CreateNotification view model data
*/
export let updateDataOnPanel = function( data ) {
    const newDaysBeforeFinishDate = _.clone( data.daysBeforeFinishDate );
    if ( newDaysBeforeFinishDate.dbValue === null ) {
        newDaysBeforeFinishDate.dbValue = 0;
        newDaysBeforeFinishDate.uiValue = 0 + '';
    }

    let dataToUpdateOnPanel = {
        ruleName: _.clone( data.ruleName ),
        eventType: _.clone( data.eventType ),
        emailIds: _.clone( data.emailIds ),
        emailSubject: _.clone( data.emailSubject ),
        emailText: _.clone( data.emailText ),
        priority: _.clone( data.priority ),
        status: _.clone( data.status ),
        daysBeforeFinishDate: newDaysBeforeFinishDate,
        workReady: _.clone( data.workReady ),
        daysBeforeStartDate: _.clone( data.daysBeforeStartDate ),
        userConfiguredEventList: _.clone( data.userConfiguredEventList ),
        isSelectedVMOForSubscription: _.clone( data.isSelectedVMOForSubscription )
    };


    let isCreateUseCase = data.isCreateUseCase;
    if ( !isCreateUseCase ) {
        // If this is Edit rule use case, than read data from selected Imansubscription object.
        updatePanelForUpdate( data, data.subscriptionVMOToUpdate, dataToUpdateOnPanel );
    } else { // Else update panel with localized values from server
        updatePanelForCreate( data, dataToUpdateOnPanel );
    }
    return dataToUpdateOnPanel;
};

/**
 * Update panel data from localization values from server
 *
 * @param {object} data - The CreateNotification view model data
 * @param {object} dataToUpdateOnPanel - Updated data.
*/
var updatePanelForCreate = function( data, dataToUpdateOnPanel ) {
    //Display string retrieved from server.
    let displayStrings = data.displayStrings;
    if ( displayStrings && displayStrings.length > 0 && data.myEventsCheckbox.dbValue === false ) {
        let eventType = data.eventType.dbValue;
        let eventTypeDisplayValue = getDisplayValue( data.eventTypeNames.dbValues, eventType );
        let eventIdAndItsuidMap = data.eventIdAndItsuidMap;

        let eventNameToLookup = eventType;
        if( eventType.includes( '__Status_ChangeTo' ) ) {
            eventNameToLookup = eventNameToLookup + '_' + data.status.dbValue;
        }
        if( eventType.includes( '__Priority_ChangeTo' ) ) {
            eventNameToLookup = eventNameToLookup + '_' + data.priority.dbValue;
        }
        let eventTypeDisplayName = eventNameToLookup;
        if ( eventIdAndItsuidMap[eventNameToLookup] !== undefined ) {
            let eventTypeVMO = cdm.getObject( eventIdAndItsuidMap[eventNameToLookup] );
            if ( eventTypeVMO ) {
                eventTypeDisplayName = eventTypeVMO.props.object_string.dbValues[0];
            }
        } else if( eventType.includes( '__Delete_Task' ) ) {
            eventTypeDisplayName = data.i18n.eventTypeDisplayDeleteTask;
        }

        //Rule type
        dataToUpdateOnPanel.eventType.dbValue = eventType;
        dataToUpdateOnPanel.eventType.dbValues[0] = eventType;
        dataToUpdateOnPanel.eventType.dispValue = eventTypeDisplayValue;
        dataToUpdateOnPanel.eventType.uiValue = eventTypeDisplayValue;
        dataToUpdateOnPanel.eventType.isEditable = true;

        //Rule Name
        let selectedObj = appCtxService.getCtx( 'selected' );
        let selectedObjName = "";
        if (selectedObj.props.object_string.dbValue) {
            selectedObjName = selectedObj.props.object_string.dbValue;
        }
        else if(selectedObj.props.object_string.dbValues && selectedObj.props.object_string.dbValues.length > 0) {
            selectedObjName = selectedObj.props.object_string.dbValues[0];
        }
        let ruleName = selectedObjName + ' : ' + eventTypeDisplayName;
        dataToUpdateOnPanel.ruleName.dbValue = ruleName;
        dataToUpdateOnPanel.ruleName.dbValues[0] = ruleName;
        dataToUpdateOnPanel.ruleName.dispValue = ruleName;
        dataToUpdateOnPanel.ruleName.uiValue = ruleName;
        dataToUpdateOnPanel.ruleName.isEditable = true;

        let emailData = getEmailRelatedData( data, eventType );

        //Email Subject
        dataToUpdateOnPanel.emailSubject.dbValue = emailData.emailSubject;
        dataToUpdateOnPanel.ruleName.dbValues[0] = ruleName;
        dataToUpdateOnPanel.emailSubject.dispValue = emailData.emailSubject;
        dataToUpdateOnPanel.emailSubject.uiValue = emailData.emailSubject;

        //Email text
        dataToUpdateOnPanel.emailText.dbValue = emailData.emailText;
        dataToUpdateOnPanel.emailText.dbValues = [];
        dataToUpdateOnPanel.emailText.dbValues[0] = emailData.emailText;
        dataToUpdateOnPanel.emailText.dispValue = emailData.emailText;
        dataToUpdateOnPanel.emailText.uiValue = emailData.emailText;
    }
};

/**
 * Update panel data from selected Imansubscription object.
 *
 * @param {object} data - The CreateNotification view model data
 * @param {object} subscriptionToUpdate - The selected Imansubscription object which needs to be updated.
 * @param {object} dataToUpdateOnPanel - Updated data.
*/
var updatePanelForUpdate = function( data, subscriptionToUpdate, dataToUpdateOnPanel ) {
    // Parse existing Imansubscription object and its handler arguments.
    let notificationStructure = saw1SubSummarySvc.parseNoificationParameters( subscriptionToUpdate.props.handler_parameters.dbValues.length, subscriptionToUpdate.props.handler_parameters.dbValues );

    let additionalEmails = notificationStructure.email_recipients;
    let notificationCondition = notificationStructure.notification_condition;
    let notificationMessage = notificationStructure.message;
    let notificationSubject = notificationStructure.subject;
    let ruleName = '';
    if( subscriptionToUpdate.props.fnd0Name.dbValues[0] !== null ) {
        ruleName = subscriptionToUpdate.props.fnd0Name.dbValues[0];
    }

    let eventTypeObject = cdm.getObject( subscriptionToUpdate.props.event_type.dbValues[0] );
    let ruleType = eventTypeObject.props.eventtype_id.dbValues[0];
    let ruleTypeInitial = eventTypeObject.props.eventtype_id.dbValues[0];

    let isProprityRule = ruleType.includes( '__Priority_ChangeTo' );
    let isStatusRule = ruleType.includes( '__Status_ChangeTo' );
    let len = ruleType.length;

    // Process arguments to populate optional data on panel
    let priorityValue = '';
    let priorityDisplayValue = '';
    if ( isProprityRule ) {
        ruleType = '__Priority_ChangeTo';
        priorityValue = ruleTypeInitial.substring( ruleType.length + 1, ruleTypeInitial.length );
        priorityDisplayValue = getDisplayValue( data.priorityList.dbValues, priorityValue );

        dataToUpdateOnPanel.priority.dbValue = priorityValue;
        dataToUpdateOnPanel.priority.dispValue = priorityDisplayValue;
        dataToUpdateOnPanel.priority.uiValue = priorityDisplayValue;
        dataToUpdateOnPanel.priority.isEditable = false;
    }

    let statusValue = '';
    let statusDisplayValue = '';
    if ( isStatusRule ) {
        ruleType = '__Status_ChangeTo';
        statusValue = ruleTypeInitial.substring( ruleType.length + 1, ruleTypeInitial.length );
        statusDisplayValue = getDisplayValue( data.statusList.dbValues, statusValue );

        dataToUpdateOnPanel.status.dbValue = statusValue;
        dataToUpdateOnPanel.status.dispValue = statusDisplayValue;
        dataToUpdateOnPanel.status.uiValue = statusDisplayValue;
        dataToUpdateOnPanel.status.isEditable = false;
    }

    if ( ruleType === '__Near_Due' ) {
        dataToUpdateOnPanel.daysBeforeFinishDate.dbValue = notificationCondition;
        dataToUpdateOnPanel.daysBeforeFinishDate.dispValue = notificationCondition;
        dataToUpdateOnPanel.daysBeforeFinishDate.uiValue = notificationCondition;
        dataToUpdateOnPanel.daysBeforeFinishDate.isEditable = false;
    }

    if ( ruleType === '__Work_Ready' ) {
        const conditionValues = notificationCondition.split( ',' );
        let workReadyOption = parseInt( conditionValues[0] );
        let valueFromArray = getValueAtIndexFromArrayData( data.workReadyList.dbValues, workReadyOption );

        dataToUpdateOnPanel.workReady.dbValue = valueFromArray.propInternalValue;
        dataToUpdateOnPanel.workReady.dispValue = valueFromArray.propDisplayValue;
        dataToUpdateOnPanel.workReady.uiValue = valueFromArray.propDisplayValue;
        dataToUpdateOnPanel.workReady.isEditable = false;

        if ( data.workReady.dbValue !== 'PredComplete' ) {
            dataToUpdateOnPanel.daysBeforeStartDate.dbValue = parseInt( conditionValues[1] );
            dataToUpdateOnPanel.daysBeforeStartDate.dispValue = conditionValues[1];
            dataToUpdateOnPanel.daysBeforeStartDate.uiValue = conditionValues[1];
            dataToUpdateOnPanel.daysBeforeStartDate.isEditable = false;
        }
    }

    let ruleTypeDisplayValue = getDisplayValue( data.eventTypeNames.dbValues, ruleType );

    dataToUpdateOnPanel.ruleName.dbValue = ruleName;
    dataToUpdateOnPanel.ruleName.dispValue = ruleName;
    dataToUpdateOnPanel.ruleName.uiValue = ruleName;

    dataToUpdateOnPanel.eventType.dbValue = ruleType;
    dataToUpdateOnPanel.eventType.dispValue = ruleTypeDisplayValue;
    dataToUpdateOnPanel.eventType.uiValue = ruleTypeDisplayValue;
    dataToUpdateOnPanel.eventType.isEditable = false;

    dataToUpdateOnPanel.emailSubject.dbValue = notificationSubject;
    dataToUpdateOnPanel.emailSubject.dispValue = notificationSubject;
    dataToUpdateOnPanel.emailSubject.uiValue = notificationSubject;

    dataToUpdateOnPanel.emailText.dbValue = notificationMessage;
    dataToUpdateOnPanel.emailText.dispValue = notificationMessage;
    dataToUpdateOnPanel.emailText.uiValue = notificationMessage;

    dataToUpdateOnPanel.emailIds.dbValue = additionalEmails;
    dataToUpdateOnPanel.emailIds.dispValue = additionalEmails;
    dataToUpdateOnPanel.emailIds.uiValue = additionalEmails;

    //Update recipients
    let recipientUids = notificationStructure.recipients;
    if ( recipientUids && recipientUids.length > 0 ) {
        dms.loadObjects( recipientUids ).then( function() {
            let recipient = [];
            for ( let i = 0; i < recipientUids.length; i++ ) {
                let recObject = cdm.getObject( recipientUids[i] );
                recipient.push( recObject );
            }
            saw1PeoplePickerUtils.addSelectedUsers( recipient, data.dataProviders.followers_provider );
        } );
    }

    // If Subscriber is Schedule or ScheduleTask, treat that object as Notification
    let subscriber = cdm.getObject( subscriptionToUpdate.props.subscriber.dbValue );
    if ( subscriber.modelType.typeHierarchyArray.indexOf( 'ScheduleTask' ) > -1 || subscriber.modelType.typeHierarchyArray.indexOf( 'Schedule' ) > -1 ) {
        dataToUpdateOnPanel.isSelectedVMOForSubscription = false;
    } else {
        dataToUpdateOnPanel.isSelectedVMOForSubscription = true; // Its subscription
    }
};

/**
 * * Get Recipients uids from followers data provider.
 *
 * @param data : the view model data
 */
var getRecipientId = function( data ) {
    let followersList = [];
    for ( let i = 0; i < data.dataProviders.followers_provider.viewModelCollection.loadedVMObjects.length; i++ ) {
        let gmUID = data.dataProviders.followers_provider.viewModelCollection.loadedVMObjects[i].uid;
        if ( gmUID !== null ) {
            let usrObject = cdm.getObject( gmUID );
            let userInfo = {
                uid: usrObject.uid,
                type: usrObject.type
            };
            followersList.push( userInfo );
        }
    }
    return followersList;
};

/**
 * * Get email related data for selectd event
 *
 * @param data : the view model data
 * @param selectdEventName : Id of selected Event
 */
var getEmailRelatedData = function( data, selectdEventName ) {
    let emailData = {
        emailSubject: '',
        emailText: ''
    };

    let selectedObj = appCtxService.getCtx( 'selected' );
    let objectType = '';
    if ( selectedObj.modelType.typeHierarchyArray.indexOf( 'ScheduleTask' ) > -1 ) {
        objectType = 'Task';
    }
    if ( selectedObj.modelType.typeHierarchyArray.indexOf( 'Schedule' ) > -1 ) {
        objectType = 'Schedule';
    }

    let displayStrings = data.displayStrings;
    let notificationSubject = '';
    let notificationMessage = '';

    if ( selectdEventName.includes( '__Priority_ChangeTo' ) ) {
        selectdEventName = '__Priority_ChangeTo';
    }

    if ( selectdEventName.includes( '__Status_ChangeTo' ) ) {
        selectdEventName = '__Status_ChangeTo';
    }

    //Key will be in the format of "Sub\Txt" + "Type of object" + "eventType"
    let eventTypeSubject = 'Sub_' + objectType + selectdEventName;
    let eventTypeText = 'Txt_' + objectType + selectdEventName;

    for ( let i = 0; i < displayStrings.length; i++ ) {
        if ( displayStrings[i].key === eventTypeSubject ) {
            notificationSubject = displayStrings[i].value;
            continue;
        }
        if ( displayStrings[i].key === eventTypeText ) {
            notificationMessage = displayStrings[i].value;
            continue;
        }
    }

    emailData.emailSubject = notificationSubject;
    emailData.emailText = notificationMessage;

    return emailData;
};


/**
 *  Get SOA input for SOA createOrUpdateNotificationRules ( Cretae or Update use case )
 *
 * @param data : the view model data
 * @param isUpdateSubscription : Update or Create use case
 */
var getCreateOrUpdateSubscriptionSOAInputsForMultiEvent = function( data ) {
    //Output structure
    let notificationRulesContainer = {
        inputs: []
    };

    let ruleNames = [];

    const listofEventTypes = data.eventType.dbValue.split(",");
    if ( listofEventTypes.length > 0 ) {
        for ( let i = 0; i < listofEventTypes.length; i++ ) {
            let additionalEmails = data.emailIds.dbValue;
            if ( !additionalEmails || additionalEmails === undefined ) {
                additionalEmails = '';
            }
            let notificationCondition = '';
            if ( listofEventTypes[i] === '__Work_Ready' ) {
                notificationCondition = '3,0'; // predecessors are complete or  start date is near
            }
            let emailData = getEmailRelatedData( data, listofEventTypes[i] );

            let additionalPropertis = [ {
                    name: EXTRA_ARG_EMAIL_SUBJECT,
                    values: [ emailData.emailSubject ]
                },
                {
                    name: EXTRA_ARG_EMAIL_TEXT,
                    values: [ emailData.emailText ]
                },
                {
                    name: EXTRA_CONDITIONS,
                    values: [ notificationCondition ]
                },
                {
                    name: EXTRA_ARG_EMAIL_RECIPIENTS,
                    values: [ additionalEmails ]
                }
            ];

            let target = appCtxService.getCtx( 'mselected' );
            let userSession = appCtxService.getCtx( 'userSession' );
            let currentUsrObject = cdm.getObject( userSession.props.user.dbValue );
            let subscriber = currentUsrObject;
            let recipient = getRecipientId( data );
            if ( recipient.length > 0 ) {
                subscriber = target[0]; // For notification, the subscriber is also Schedule or ScheduleTask
            } else {
                recipient.push({
                    uid: subscriber.uid,
                    type: subscriber.type
                });
            }
            let eventTypeDisplayName = listofEventTypes[i];
            if ( data.eventIdAndItsuidMap[ listofEventTypes[i]] !== undefined ) {
                let eventTypeVMo = cdm.getObject( data.eventIdAndItsuidMap[ listofEventTypes[i]] );
                if ( eventTypeVMo ) {
                    eventTypeDisplayName = eventTypeVMo.props.object_string.dbValues[0];
                }
            }

            let ruleName = target[0].props.object_string.dbValue + ' : ' + eventTypeDisplayName;

            // Creating an array of rule names which will get created, later will join using delimiter ';'.
            ruleNames.push(`'${ruleName}'`);

            let input = {
                name: ruleName,
                ruleType: listofEventTypes[i],
                status: true,
                update: false,
                target:
                {
                    uid: target[0].uid,
                    type: target[0].type
                },
                subscriber:
                {
                    uid: subscriber.uid,
                    type: subscriber.type
                },
                recipient: recipient,
                listOfAdditionalProperties: additionalPropertis
            };
            notificationRulesContainer.inputs.push( input );
        }
    }

    // Creating ';' separated list of rule names which will get created.
    let multiEventRulesName = ruleNames.join("; ");

    return {
        notificationRulesContainer: notificationRulesContainer,
        multiEventRulesName: multiEventRulesName
    };
};


/**
 *  Get SOA input for SOA createOrUpdateNotificationRules ( Cretae or Update use case )
 *
 * @param data : the view model data
 * @param isUpdateSubscription : Update or Create use case
 */
export let getCreateOrUpdateSubscriptionSOAInputs = function( data, isUpdateSubscription ) {
    //Output structure
    let notificationRulesContainer = {
        inputs: []
    };

    let multiEventRulesName = data.ruleName.uiValue;

    //If Multi Event check box is selected
    if ( data.myEventsCheckbox.dbValue === true ) {
        let multiEventInputs = getCreateOrUpdateSubscriptionSOAInputsForMultiEvent(data);

        //createOrUpdateNotificationRules SOA inputs for multi events rule creation.
        notificationRulesContainer = multiEventInputs.notificationRulesContainer;

        //Semi-colon separated list of rule names create for each event types in My Events.
        //For e.g. 'ST1 : Near Due'; 'ST1 : Finish Date Change'
        multiEventRulesName = multiEventInputs.multiEventRulesName;

    } else {
        let additionalEmails = data.emailIds.dbValue;
        if ( !additionalEmails || additionalEmails === undefined ) {
            additionalEmails = '';
        }
        let notificationMessage = data.emailText.dbValue;
        let notificationSubject = data.emailSubject.dbValue;
        let ruleName = data.ruleName.dbValue;
        let ruleType = data.eventType.dbValue;

        if ( ruleType === '__Priority_ChangeTo' ) {
            ruleType = ruleType + '_' + data.priority.dbValue;
        }

        if ( ruleType === '__Status_ChangeTo' ) {
            ruleType = ruleType + '_' + data.status.dbValue;
        }

        let notificationCondition = '';
        if ( ruleType === '__Near_Due' ) {
            notificationCondition = data.daysBeforeFinishDate.uiValue;
        }

        if ( ruleType === '__Work_Ready' ) {
            let workReadyOptionString = data.workReady.dbValue;
            let indexOfWorkReady = getIndexOfEntryFromArrayData( data.workReadyList.dbValues, workReadyOptionString );
            notificationCondition = indexOfWorkReady.toString();

            let daysBeforeStartDate = -1;
            if ( workReadyOptionString !== 'PredComplete' ) {
                daysBeforeStartDate = data.daysBeforeStartDate.dbValue;
                if ( daysBeforeStartDate ) {
                    notificationCondition = notificationCondition + "," + daysBeforeStartDate.toString();
                }
            }
        }

        //If expiration_date is not NULLDATA, the subscription is Inactive.
        let isActive = true;
        if ( data.subscriptionVMOToUpdate && data.subscriptionVMOToUpdate.props.expiration_date.dbValue > 0 ) {
            isActive = false;
        }

        let isUpdate = isUpdateSubscription;
        let target = appCtxService.getCtx( 'mselected' );
        let userSession = appCtxService.getCtx( 'userSession' );
        let currentUsrObject = cdm.getObject( userSession.props.user.dbValue );
        let recipients = getRecipientId(data);

        for ( let i = 0; i < target.length; i++ ) {
            let recipientsInput = [...recipients];
            let subscriber = {};
            if ( isUpdate ) {
                // Extract the subscriber from subscriptionVMOToUpdate.
                subscriber.uid = data.subscriptionVMOToUpdate.props.subscriber.dbValue;
                subscriber.type = data.subscriptionVMOToUpdate.props.subscriber.type;
            } else {
                //If no followers are selcted, treat this as Subscribe by current loggd in user else its notification
                subscriber = currentUsrObject;
                if ( recipientsInput.length > 0 ) {
                    subscriber = target[i]; // For notification, the subscriber is also Schedule or ScheduleTask
                } else {
                    recipientsInput.push({
                        uid: subscriber.uid,
                        type: subscriber.type
                    });
                }
            }

            let additionalPropertis = [
                {
                    name: EXTRA_ARG_EMAIL_SUBJECT,
                    values: [ notificationSubject ]
                },
                {
                    name: EXTRA_ARG_EMAIL_TEXT,
                    values: [ notificationMessage ]
                },
                {
                    name: EXTRA_CONDITIONS,
                    values: [ notificationCondition ]
                },
                {
                    name: EXTRA_ARG_EMAIL_RECIPIENTS,
                    values: [ additionalEmails ]
                }
            ];

            let input = {
                name: ruleName,
                ruleType: ruleType,
                status: isActive,
                update: isUpdate,
                target:
                {
                    uid: target[i].uid,
                    type: target[i].type
                },
                subscriber:
                {
                    uid: subscriber.uid,
                    type: subscriber.type
                },
                recipient: recipientsInput,
                listOfAdditionalProperties: additionalPropertis
            };

            notificationRulesContainer.inputs.push( input );
        }
    }
    return {
        inputs: notificationRulesContainer.inputs,
        multiEventRulesName: multiEventRulesName
    };
};

/**
 *  Get SOA input for SOA createOrUpdateNotificationRules ( Activate or Deactivate rule )
 *
 * @param selectedSubscriptions : Selected Imansubscription object which needs to be Activated or Deactivated.
 * @param  operationName: Activate or Deactivate
 */
export let getActivateDeActivateCommandInput = function( selectedSubscriptions, operationName ) {
    let notificationRulesContainer = [];
    for ( let i = 0; i < selectedSubscriptions.length; i++ ) {
        let selectedSubscription = selectedSubscriptions[i];
        let notificationStructure = saw1SubSummarySvc.parseNoificationParameters( selectedSubscription.props.handler_parameters.dbValues.length, selectedSubscription.props.handler_parameters.dbValues );

        let additionalEmails = notificationStructure.email_recipients;
        let notificationCondition = notificationStructure.notification_condition;
        let notificationMessage = notificationStructure.message;
        let notificationSubject = notificationStructure.subject;

        let eventTypeObject = cdm.getObject( selectedSubscription.props.event_type.dbValue );
        let ruleName = '';
        if ( selectedSubscription.props.fnd0Name.dbValues[0] !== null ) {
            ruleName = selectedSubscription.props.fnd0Name.dbValues[0];
        }

        let ruleType = eventTypeObject.props.eventtype_id.dbValues[0];
        let isActive = false; // By default De-Activate
        if ( operationName === 'Activate' ) {
            isActive = true;
        }
        let isUpdate = true;
        let target = cdm.getObject( selectedSubscription.props.target.dbValue );
        let subscriber = cdm.getObject( selectedSubscription.props.subscriber.dbValue );
        let recipientUids = notificationStructure.recipients;

        let recipient = [];
        if ( recipientUids && recipientUids.length > 0 ) {
            for ( let i = 0; i < recipientUids.length; i++ ) {
                let userInfo = {
                    uid: recipientUids[i]
                };
                recipient.push( userInfo );
            }
        }

        let additionalPropertis = [
            {
                name: EXTRA_ARG_EMAIL_SUBJECT,
                values: [ notificationSubject ]
            },
            {
                name: EXTRA_ARG_EMAIL_TEXT,
                values: [ notificationMessage ]
            },
            {
                name: EXTRA_CONDITIONS,
                values: [ notificationCondition ]
            },
            {
                name: EXTRA_ARG_EMAIL_RECIPIENTS,
                values: [ additionalEmails ]
            }
        ];

        let input = {
            name: ruleName,
            ruleType: ruleType,
            status: isActive,
            update: isUpdate,
            target:
            {
                uid: target.uid,
                type: target.type
            },
            subscriber:
            {
                uid: subscriber.uid,
                type: subscriber.type
            },
            recipient: recipient,
            listOfAdditionalProperties: additionalPropertis
        };

        notificationRulesContainer.push( input );
    }

    return notificationRulesContainer;
};

/**
 *  Get SOA input for SOA deleteNotificationRules ( Delete rule )
 *
 * @param selectedSubscriptions : Selected Imansubscription object which needs to be Activated or Deactivated.
 * @param  operationName: Activate or Deactivate
 */

export let getDeleteNotificationSOAInput = function( selectedSubscriptions ) {
    let notificationRuleContainer = [];

    for ( let i = 0; i < selectedSubscriptions.length; i++ ) {
        let selectedSubscription = selectedSubscriptions[i];
        let eventTypeObject = cdm.getObject( selectedSubscription.props.event_type.dbValue );
        let ruleType = eventTypeObject.props.eventtype_id.dbValues[0];
        let target = cdm.getObject( selectedSubscription.props.target.dbValue );
        let subscriber = cdm.getObject( selectedSubscription.props.subscriber.dbValue );

        notificationRuleContainer.push( {
            ruleType: ruleType,
            target: target,
            subscriber: subscriber
        } );
    }

    return notificationRuleContainer;
};

/**
 * Configure panel if there are multiple events configured for user
 * @param data : the view model data
 * @param userConfiguredEventList : List of events configured for user
 */
export let initPanelForMultipleEvents = function( data, userConfiguredEventList ) {
    let dataToUpdateOnPanel = {
        eventType: _.clone( data.eventType )
    };

    if ( userConfiguredEventList && userConfiguredEventList.length > 0 ) {
        let eventName = '';
        let eventDisplayName = '';
        for ( let i = 0; i < userConfiguredEventList.length; i++ ) {
            eventName += userConfiguredEventList[i].props.eventtype_id.dbValues[0];
            eventDisplayName += userConfiguredEventList[i].props.object_string.dbValues[0];
            if ( i < userConfiguredEventList.length - 1 ) {
                eventName += ',';
                eventDisplayName += ',';
            }
        }

        dataToUpdateOnPanel.eventType.dbValue = eventName;
        dataToUpdateOnPanel.eventType.dbValues = [];
        dataToUpdateOnPanel.eventType.dbValues[0] = eventName;
        dataToUpdateOnPanel.eventType.dispValue = eventDisplayName;
        dataToUpdateOnPanel.eventType.uiValue = eventDisplayName;
        dataToUpdateOnPanel.eventType.uiValues = [];
        dataToUpdateOnPanel.eventType.uiValues[0] = eventDisplayName;
        dataToUpdateOnPanel.eventType.isEditable = false;
    }

    return dataToUpdateOnPanel;
};

export let resetMultiEventCheckBox = function( data ) {
    data.myEventsCheckbox.dbValue = false;
};

/**
 * Update panel when multiple event check box is unchecked
 *
 * @param {object} data - The CreateNotification view model data
 * @param {object} dataToUpdateOnPanel - Updated data.
*/
export let updatePanelForUncheckMultiEventCheckBox = function( data ) {
    let dataToUpdateOnPanel = {
        ruleName: data.ruleName,
        eventType: data.eventType,
        emailIds: data.emailIds,
        emailSubject: data.emailSubject,
        emailText: data.emailText,
        priority: data.priority,
        status: data.status,
        daysBeforeFinishDate: data.daysBeforeFinishDate,
        workReady: data.workReady,
        daysBeforeStartDate: data.daysBeforeStartDate,
        userConfiguredEventList: data.userConfiguredEventList
    };

    //Display string retrieved from server.
    let displayStrings = data.displayStrings;
    if ( displayStrings && displayStrings.length > 0 ) {
        let eventType = data.eventType.newValue;
        if ( eventType === '' || eventType === null || eventType === undefined ) {
            eventType = data.eventTypeNames.dbValues[0].propInternalValue;
        }

        let eventTypeDisplayValue = getDisplayValue( data.eventTypeNames.dbValues, eventType );

        //Rule type
        dataToUpdateOnPanel.eventType.dbValue = eventType;
        dataToUpdateOnPanel.eventType.dispValue = eventTypeDisplayValue;
        dataToUpdateOnPanel.eventType.uiValue = eventTypeDisplayValue;
        dataToUpdateOnPanel.eventType.isEditable = true;

        let emailData = getEmailRelatedData( data, eventType );

        //Email Subject
        dataToUpdateOnPanel.emailSubject.dbValue = emailData.emailSubject;
        dataToUpdateOnPanel.emailSubject.dispValue = emailData.emailSubject;
        dataToUpdateOnPanel.emailSubject.uiValue = emailData.emailSubject;

        //Email text
        dataToUpdateOnPanel.emailText.dbValue = emailData.emailText;
        dataToUpdateOnPanel.emailText.dispValue = emailData.emailText;
        dataToUpdateOnPanel.emailText.uiValue = emailData.emailText;

        dataToUpdateOnPanel.userConfiguredEventList = [];
    }

    return dataToUpdateOnPanel;
};

/**
 * Get all available event ids for my configured event list.
 * This wil return all events ids along with event list for status and priority.
 *
 * @param {object} eventTypeNames - The list of event objects
 * @param {object} statusList - List of status
 * @param {object} eventTypeNames -List of Priority
 * @return allEventnames - List of all valid event names
*/
var getAllEventIds = function( eventTypeNames, statusList, priorityList ) {
    let allEventnames = [];
    for ( let j = 0; j < eventTypeNames.dbValues.length; j++ ) {
        if ( eventTypeNames.dbValues[j].propInternalValue === '__Status_ChangeTo' ) {
            for ( let s = 0; s < statusList.dbValues.length; s++ ) {
                let eventInfo = {};
                eventInfo.propInternalValue = eventTypeNames.dbValues[j].propInternalValue + '_' + statusList.dbValues[s].propInternalValue;
                allEventnames.push( eventInfo );
            }
        } else if ( eventTypeNames.dbValues[j].propInternalValue === '__Priority_ChangeTo' ) {
            for ( let p = 0; p < priorityList.dbValues.length; p++ ) {
                let eventInfo = {};
                eventInfo.propInternalValue = eventTypeNames.dbValues[j].propInternalValue + '_' + priorityList.dbValues[p].propInternalValue;
                allEventnames.push( eventInfo );
            }
        } else {
            let eventInfo = {};
            eventInfo.propInternalValue = eventTypeNames.dbValues[j].propInternalValue;
            allEventnames.push( eventInfo );
        }
    }
    return allEventnames;
};

/**
 *  Get configured event list for user from preference output
 *
 * @param soaOutput : preference values in SOA output
 * @param eventList : List of all valid Events
 * @param statusList : Status list
 * @param priorityList : Priority list
 * @return eventTypeObjects - List of event type objects which needs to be displayed in configured event list.
 */
export let getConfiguredEventTypes = function( soaOutput, data, eventTypeNames, statusList, priorityList ) {
    let configuredEventNames = [];
    if ( soaOutput && soaOutput.preferences && soaOutput.preferences.length > 0 ) {
        configuredEventNames = soaOutput.preferences[0].values;
    }

    let allEventIds = getAllEventIds( eventTypeNames, statusList, priorityList );
    let eventTypeObjects = [];

    if ( configuredEventNames ) {
        for ( let i = 0; i < configuredEventNames.length; i++ ) {
            for ( let j = 0; j < allEventIds.length; j++ ) {
                if ( allEventIds[j].propInternalValue === configuredEventNames[i] ) {
                    if ( data.eventIdAndItsuidMap[ configuredEventNames[i]] !== undefined ) {
                        let eventTypeVMo = cdm.getObject( data.eventIdAndItsuidMap[ configuredEventNames[i]] );
                        if ( eventTypeVMo ) {
                            eventTypeObjects.push( eventTypeVMo );
                        }
                    }
                }
            }
        }
    }

    eventBus.publish( 'loadAvailableEvents' );

    return eventTypeObjects;
};

/**
 *  Get configured event list for user from preference output : This is called from create notification sub panel.
 * This method will eliminate events which are already created for current object.
 *
 * @param soaOutput : preference values in SOA output
 * @param eventList : List of all valid Events
 * @param statusList : Status list
 * @param priorityList : Priority list
 * @return eventTypeObjects - List of event type objects which needs to be displayed in configured event list.
 */
export let getConfiguredEventTypesForCreatePanel = function( soaOutput, data, eventTypeNames, statusList, priorityList ) {
    let configuredEventNames = [];
    if ( soaOutput && soaOutput.preferences ) {
        configuredEventNames = soaOutput.preferences[0].values;
    }

    let existingEventsOnObject = [];
    if ( data.dataProviders.existingSubscription && data.dataProviders.existingSubscription.viewModelCollection.loadedVMObjects.length > 0 ) {
        existingEventsOnObject = data.dataProviders.existingSubscription.viewModelCollection.loadedVMObjects;
    }

    let existingEventIds = [];
    for ( let e = 0; e < existingEventsOnObject.length; e++ ) {
        let eventTypeObject = cdm.getObject( existingEventsOnObject[e].props.event_type.dbValue );
        let eventName = eventTypeObject.props.eventtype_id.dbValues[0];
        existingEventIds.push( eventName );
    }

    let allEventIds = getAllEventIds( eventTypeNames, statusList, priorityList );
    let eventTypeObjects = [];

    if ( configuredEventNames ) {
        for ( let i = 0; i < configuredEventNames.length; i++ ) {
            if ( existingEventIds.includes( configuredEventNames[i] ) ) {
                continue;
            }
            for ( let j = 0; j < allEventIds.length; j++ ) {
                if ( allEventIds[j].propInternalValue === configuredEventNames[i] ) {
                    if ( data.eventIdAndItsuidMap[ configuredEventNames[i]] !== undefined ) {
                        let eventTypeVMo = cdm.getObject( data.eventIdAndItsuidMap[ configuredEventNames[i]] );
                        if ( eventTypeVMo ) {
                            eventTypeObjects.push( eventTypeVMo );
                        }
                    }
                }
            }
        }
    }

    return eventTypeObjects;
};

/**
 *  Get all available events.
 *
 * @param {viewModelObject} data - json object
 *
 * @return eventTypeObjects - List of event type objects which needs to be displayed in available event list.
 */
export let getAvailableEvents = function( data ) {
    let eventTypeObjects = [];

    let eventList = [];
    let statusList = [];
    let priorityList = [];
    let panelContext = appCtxService.getCtx( 'panelContext' );
    if ( panelContext ) {
        eventList = panelContext.eventTypeNames;
        statusList = panelContext.statusList;
        priorityList = panelContext.priorityList;
    }

    let configuredEventNames = [];
    let configuredObjects = [];
    if( data.data.userConfiguredEventList && data.data.userConfiguredEventList.length > 0 ) {
        configuredObjects = data.data.userConfiguredEventList;
    }
    for ( let i = 0; i < configuredObjects.length; i++ ) {
        configuredEventNames.push( configuredObjects[i].props.eventtype_id.dbValues[0] );
    }

    let allEventIds = getAllEventIds( eventList, statusList, priorityList );

    for ( let i = 0; i < allEventIds.length; i++ ) {
        //If its present in Configured event list, don't add to available events.
        if ( configuredEventNames.includes( allEventIds[i].propInternalValue ) ) {
            continue;
        }

        if ( data.eventIdAndItsuidMap[ allEventIds[i].propInternalValue] !== undefined ) {
            let eventTypeVMo = cdm.getObject( data.eventIdAndItsuidMap[ allEventIds[i].propInternalValue] );
            if ( eventTypeVMo ) {
                eventTypeObjects.push( eventTypeVMo );
            }
        }
    }
    return eventTypeObjects;
};

/**
 * Add the event type to the available list by updating preference SAW1_followMultiEventConfiguredEventTypes.
 * @param {viewModelObject} data - json object
 */

export let addEventToUserConfiguredEvents = function( data ) {
    let AddObjects = data.dataProviders.availableEventTypesProvider.selectedObjects;
    if ( AddObjects.length > 0 ) {
        let prefNewValues = [];

        // Collect already configured events
        let configuredObjects = data.dataProviders.configuredEventTypesProvider.viewModelCollection.loadedVMObjects;
        for ( let i = 0; i < configuredObjects.length; i++ ) {
            if ( !prefNewValues.includes( configuredObjects[i].props.eventtype_id.dbValue ) ) {
                prefNewValues.push( configuredObjects[i].props.eventtype_id.dbValue );
            }
        }

        // Append selected events from availableEventTypesProvider data provider
        for ( let j = 0; j < AddObjects.length; j++ ) {
            if ( !prefNewValues.includes( AddObjects[j].props.eventtype_id.dbValue ) ) {
                prefNewValues.push( AddObjects[j].props.eventtype_id.dbValue );
            }
        }

        // update configuration
        return preferenceSvc.setStringValue( 'SAW1_followMultiEventConfiguredEventTypes', prefNewValues );
    }
    return null;
};


/**
 * Remove the event type from available list by updating preference SAW1_followMultiEventConfiguredEventTypes.
 * @param {viewModelObject} data - json object
 */

export let removeEventFromUserConfiguredEvents = function( data ) {
    let removeObjects = data.dataProviders.configuredEventTypesProvider.selectedObjects;
    if ( removeObjects.length > 0 ) {
        let configuredObjects = data.dataProviders.configuredEventTypesProvider.viewModelCollection.loadedVMObjects;
        let remainObjects = _.difference( configuredObjects, removeObjects );

        let prefNewValues = [];
        for ( let i = 0; i < remainObjects.length; i++ ) {
            prefNewValues.push( remainObjects[i].props.eventtype_id.dbValue );
        }

        // update configuration
        return preferenceSvc.setStringValue( 'SAW1_followMultiEventConfiguredEventTypes', prefNewValues );
    }
    return null;
};

/**
 * Add the event type to the available list
 * @param {ViewModelObject} vmo - selected event type object..
 */
export let addToEventConfig = function() {
    eventBus.publish( 'Saw1EventAddCellCmdEvent' );
};

/**
 * Removes the event type from the configuration
 *
 * @param {ViewModelObject} vmo - selected event type object.
 */
export let removeFromEventConfig = function() {
    eventBus.publish( 'Saw1EventRemoveCellCmdEvent' );
};


/**
 *Clear all selection from data provider.
 *
 * @param {commandContext} commandContext - Command context
 */
export let clearSelectionFromExistingSubscriptions = function( commandContext ) {
    while ( commandContext.dataProviders.existingSubscription.selectedObjects.length > 0 ) {
        commandContext.dataProviders.existingSubscription.selectedObjects.pop();
    }
    //clear selection
    commandContext.dataProviders.existingSubscription.changeObjectsSelection( 0,
        commandContext.dataProviders.existingSubscription.getLength() - 1, false );
};

/**
 * Process eventTypes response to list event types
 *
 * @param {Object} SOA reponse
 * @return [{Object}] List of event types
 */
export let processEventTypes = function( response ) {
    let eventIdAndItsuidMap = {};
    if ( response && response.commonEventTypes && response.commonEventTypes.length > 0 ) {
        for ( let i = 0; i < response.commonEventTypes.length; i++ ) {
            let eventUid = response.commonEventTypes[i].uid;
            let eventVMO = cdm.getObject( eventUid );
            let eventtypeId = eventVMO.props.eventtype_id.dbValues[0];
            eventIdAndItsuidMap[eventtypeId] = eventUid;
        }
    }
    return eventIdAndItsuidMap;
};

export let getExistingSubscription = function( soaResponse ) {
    let subscriptions = [];
    if( soaResponse.subscriptions && soaResponse.subscriptions.length > 0 ) {
        subscriptions = soaResponse.subscriptions;
    }
    if ( subscriptions && subscriptions.length > 1 && subscriptions[0].type === 'ImanSubscription' && subscriptions[0].props && subscriptions[0].props.expiration_date ) {
        subscriptions.sort( ( firstEl, secondEl ) => {
            let firstElValue = firstEl.props.expiration_date.dbValues[0] === null;
            let secondElValue = secondEl.props.expiration_date.dbValues[0] === null;
            if ( firstElValue === secondElValue ) {
               return 0;
            }
            return firstElValue ? -1 : 1;
        } );
    }
    return subscriptions;
};

exports = {
    updateDataOnPanel,
    getCreateOrUpdateSubscriptionSOAInputs,
    getActivateDeActivateCommandInput,
    getDeleteNotificationSOAInput,
    initializePanelData,
    getAvailableEvents,
    addEventToUserConfiguredEvents,
    removeEventFromUserConfiguredEvents,
    addToEventConfig,
    removeFromEventConfig,
    getConfiguredEventTypes,
    initPanelForMultipleEvents,
    updatePanelForUncheckMultiEventCheckBox,
    getConfiguredEventTypesForCreatePanel,
    resetMultiEventCheckBox,
    clearSelectionFromExistingSubscriptions,
    processEventTypes,
    getExistingSubscription
};
export default exports;
