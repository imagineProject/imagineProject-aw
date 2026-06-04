// Copyright (c) 2022 Siemens

/**
 * This implements the Schedule task subscriptions summary overview related methods.
 *
 * @module js/Saw1SubscriptionSummaryNotificationService
 */
import appCtxSvc from 'js/appCtxService';
import awPromiseService from 'js/awPromiseService';
import clientDataModel from 'soa/kernel/clientDataModel';
import commandPanelService from 'js/commandPanel.service';
import dmService from 'soa/dataManagementService';
import eventBus from 'js/eventBus';
import editHandlerService from 'js/editHandlerService';
import localeService from 'js/localeService';
import messageService from 'js/messagingService';
import soaService from 'soa/kernel/soaService';
import _ from 'lodash';

/**
 * Define public API.
 */
var exports = {};
var saveHandler = {};

//Handler Argument constants
var NOTIFICATION_PARAMETER_SUBJECT = '-subject';
var NOTIFICATION_PARAMETER_MESSAGE = '-message';
var NOTIFICATION_PARAMETER_RECIPIENTS = '-recipients';
var NOTIFICATION_PARAMETER_EMAIL_RECIPIENTS = '-email_recipients';
var NOTIFICATION_PARAMETER_CONDITION = '-condition';
var NOTIFICATION_PARAMETER_DELIVERY_STATUS = '-delivery_status';
var EXTRA_ARG_EMAIL_SUBJECT = 'email_subject';
var EXTRA_ARG_EMAIL_TEXT  = 'email_message';
var EXTRA_ARG_EMAIL_RECIPIENTS = 'email_recipients';
var EXTRA_CONDITIONS = 'condition';
var EXTRA_ARG_CHANGE_OWNER = "change_owner";

/**
 * Get semi-colon separated list of recipients from List of recipients object.
 *
 * @param {object} recipients - List of recipient objects.
 * @return {String} - Semi-colon separated list of recipients.
 *
 */
function getRecipients( recipients ) {
    if( recipients ) {
        let recipientsArr = [];
        var localTextBundle = localeService.getLoadedText( 'ScheduleManagerMessages' );

        for( let recipientObj of recipients ) {
            // To be discussed - Below implementation could be changed later.
            // If recipient object is not of type Schedule get object_string property of the object.
            // Else if, recipient object is of type Schedule show recipient value as 'All members'.
            if( recipientObj.type !== 'Schedule' ) {
                recipientsArr.push( recipientObj.props.object_string.uiValues[0] );
            } else if( recipientObj.type === 'Schedule' ) {
                recipientsArr.push( localTextBundle['allMembers'] );
            }
        }

        return recipientsArr.join( '; ' );
    }
    return '';
}


/**
 * Get Recipients, Subject and Message data to populate on panel.
 *
 * @param {object} subscriptionObject - Selected subscription object.
 * @param {object} data - Data.
 * @return {object} - Object contains value of Recipients, Subject and Message.
 *
 */
export let populateNotificationData = function( subscriptionObject, data ) {
    const deferred = awPromiseService.instance.defer();

    if( subscriptionObject ) {
        const newDataRecipients = _.clone( data.recipients );
        const newDataSubject = _.clone( data.subject );
        const newDataMessage = _.clone( data.message );
        const newDataIsActive = _.clone( data.isActive );
        const newDataDaysBeforeFinishDate = _.clone( data.daysBeforeFinishDate );
        const newDataWorkReady = _.clone( data.workReady );

        // Parse handler_parameters property of subscription object to get notification data.
        const notificationStructure = parseNoificationParameters( subscriptionObject.props.handler_parameters.dbValues.length, subscriptionObject.props.handler_parameters.dbValues );

        // Get recipients uid from notification structure
        const recipientUids = notificationStructure.recipients;

        if ( recipientUids && recipientUids.length > 0 ) {
            dmService.loadObjects( recipientUids ).then( function() {
                let recipients = [];
                for ( let i = 0; i < recipientUids.length; i++ ) {
                    const recObject = clientDataModel.getObject( recipientUids[i] );
                    recipients.push( recObject );
                }

                // Get event type object
                const eventTypeObject = clientDataModel.getObject( subscriptionObject.props.event_type.dbValue );

                //If expiration_date is not NULLDATA, the subscription is Inactive.
                let isActive = true;
                if ( subscriptionObject.props.expiration_date.dbValue > 0 ) {
                    isActive = false;
                }

                newDataIsActive.dbValue = isActive;
                newDataIsActive.uiValue = isActive;

                // If, event type is '__Work_Ready' get value from notification condition, translate integer value from notification...
                // condition from list of values corresponding to that condition.
                // Else if, event type is '__Near_Due' get value from notification condition.
                if( eventTypeObject && eventTypeObject.props.eventtype_id && eventTypeObject.props.eventtype_id.dbValues[0] === '__Work_Ready' ) {
                    const conditionValues = notificationStructure.notification_condition.split( ',' );
                    let valueFromArray = data.workReadyList.dbValues[parseInt( conditionValues )];
                    newDataWorkReady.dbValue = valueFromArray.propInternalValue;
                    newDataWorkReady.uiValue = valueFromArray.propDisplayValue;
                } else if( eventTypeObject && eventTypeObject.props.eventtype_id && eventTypeObject.props.eventtype_id.dbValues[0] === '__Near_Due' ) {
                    newDataDaysBeforeFinishDate.dbValue = notificationStructure.notification_condition;
                    newDataDaysBeforeFinishDate.uiValue = notificationStructure.notification_condition;
                }

                // Get semi-colon separated value of recipients object_string property.
                recipients = getRecipients( recipients );

                newDataRecipients.dbValue = recipients;
                newDataRecipients.uiValue = recipients;

                // Get additional emails related information.
                let additionEmails = notificationStructure.email_recipients;

                // Adding additional emails information to recipients data.
                if( additionEmails && additionEmails !== '' ) {
                    newDataRecipients.uiValue = [ recipients, additionEmails ].join( '; ' );
                }

                // Get subject information from notification rule.
                newDataSubject.uiValue = notificationStructure.subject;

                // Get message information from notification rule.
                newDataMessage.uiValue = notificationStructure.message;
                newDataMessage.dbValue = notificationStructure.message;

                // Adding parentUid value to message and isActive, which will be used later when this property is added to VMO.
                newDataMessage.parentUid = subscriptionObject.uid;
                newDataIsActive.parentUid = subscriptionObject.uid;

                deferred.resolve( {
                    recipients : newDataRecipients,
                    subject : newDataSubject,
                    message: newDataMessage,
                    isActive: newDataIsActive,
                    daysBeforeFinishDate: newDataDaysBeforeFinishDate,
                    workReady: newDataWorkReady,
                    eventType: eventTypeObject
                } );
            } );
        }
    }

    return deferred.promise;
};

/**
 * Get followers data to populate on splm-table.
 *
 * @param {object} subscriptionObject - Selected subscription object.
 * @param {object} followerTableProvider - Data provider.
 * @return {object} - Object contains serchResults i.e. recipients object, totalFound - no. of recipients object and notifcation rule.
 *
 */
export let populateFollowersDataProvider = function( subscriptionObject, followerTableProvider ) {
    const deferred = awPromiseService.instance.defer();

    // Parse handler_parameters property of subscription object to get notification data.
    const notificationRule = parseNoificationParameters( subscriptionObject.props.handler_parameters.dbValues.length, subscriptionObject.props.handler_parameters.dbValues );

    const recipientUids = notificationRule.recipients;

    if ( recipientUids && recipientUids.length > 0 ) {
        dmService.loadObjects( recipientUids ).then( function() {
            let recipient = [];
            for ( let i = 0; i < recipientUids.length; i++ ) {
                const recObject = clientDataModel.getObject( recipientUids[i] );
                recipient.push( recObject );
            }

            followerTableProvider.update( recipient, recipient.length );

            deferred.resolve( {
                searchResults: recipient,
                totalFound: recipient.length,
                notificationData: notificationRule
            } );
        } );
    }
    return deferred.promise;
};

/**
 * Update IsActive property if checkbox is clicked.
 *
 * @param {object} vmo - ViewModelObject which is being modified.
 *
 */
export let updateIsActive = function( vmo ) {
    if ( vmo && vmo.props.isActive ) {
        vmo.props.isActive.displayValueUpdated = true;
        vmo.props.isActive.valueUpdated = true;
    }
};

/**
 * Get updated recipients list after removing selected rows from table after unfollow button is clicked.
 *
 * @param {object} selectedUsers - Selected rows in table.
 * @param {object} recipientsData - Current list of recipients.
 * @return {object} - updated list of recipients.
 *
 */
export let getUpatedRecipients = function( selectedUsers, recipientsData ) {
    return recipientsData.filter( function( recipient ) {
        for( let inx = 0; inx < selectedUsers.length; ++inx ) {
            if ( recipient.uid === selectedUsers[inx].uid ) {
                return false;
            }
        }
        return true;
    } );
};

/**
 * Get semi-colon separated list of selected recipients and verify if subscriber is selected or not.
 *
 * @param {object} subscriptionObject - Selected subscription object.
 * @param {object} selectedObjects - Selected rows in table.
 * @return {object} - Object contains isSubscriberSelected i.e.subscruber is selected or not and recipientsValue i.e. semi-colon separated list of selected recipients .
 *
 */
export let getInformationToUnfollow = function( subscriptionObject, selectedObjects ) {
    if ( subscriptionObject.props.target.dbValue === "" )
    {
        throw 'unFollowErrorNoAccess';
    }
    const recipientsValue = getRecipients( selectedObjects );

    let isSubscriberSelected = false;

    // Check if subscriber row is selected or not to unfollow
    for ( let inx = 0; inx < selectedObjects.length; ++inx ) {
        if( subscriptionObject.props.subscriber.dbValues[0] === selectedObjects[inx].uid ) {
            isSubscriberSelected = true;
            break;
        }
    }

    return {
        isSubscriberSelected: isSubscriberSelected,
        recipientsValue: recipientsValue
    };
};

/**
 * Get SOA inputs needed to update followers table
 *
 * @param {object} selectedSubscription - Selected subscription object.
 * @param {object} followerTableProvider - Follower table data provider.
 * @param {Boolean} isFollowersSectionUnfollowClicked - Unfollow button clicked from Followers section of Overview page.
 * @param {Object} loggedInUser - Current logged-in user
 * @return {object} - Object contains SOA inputs needed to call createOrUpdateNotificationRules once unfollow is clicked.
 *
 */
export let getUnfollowCommandSOAInput = function (selectedSubscription, followerTableProvider, isFollowersSectionUnfollowClicked, loggedInUser) {

    // Parse handler_parameters property of subscription object to get notification data.
    const notificationStructure = parseNoificationParameters( selectedSubscription.props.handler_parameters.dbValues.length, selectedSubscription.props.handler_parameters.dbValues );

    // Get additional emails information.
    const additionalEmails = notificationStructure.email_recipients;

    // Get condition information.
    const notificationCondition = notificationStructure.notification_condition;

    // Get message information.
    const notificationMessage = notificationStructure.message;

    // Get subject information.
    const notificationSubject = notificationStructure.subject;

    // Get event type information.
    let eventTypeObject = clientDataModel.getObject( selectedSubscription.props.event_type.dbValue );

    // Get rule name.
    let ruleName = selectedSubscription.props.fnd0Name.dbValues[0];

    // Get rule type from event object.
    let ruleType = eventTypeObject.props.eventtype_id.dbValues[0];

    // If expiration_date is not NULLDATA, the subscription is Inactive.
    let isActive = true;
    if ( selectedSubscription.props.expiration_date.dbValue > 0 ) {
        isActive = false;
    }

    let isUpdate = true;

    // Get target and subscriber information.
    let target = clientDataModel.getObject( selectedSubscription.props.target.dbValue );
    let subscriber = clientDataModel.getObject( selectedSubscription.props.subscriber.dbValue );

    // Get and load recipients.
    let recipientUids = notificationStructure.recipients;

    let recipient = [];
    if ( recipientUids && recipientUids.length > 0 ) {
        for ( let i = 0; i < recipientUids.length; i++ ) {
            let recObject = clientDataModel.getObject( recipientUids[i] );
            let userInfo = {
                uid: recObject.uid,
                type: recObject.type
            };
            recipient.push( userInfo );
        }
    }

    // IF isFollowersSectionUnfollowClicked is true, Get updated recipients list by removing selected objects in followerTableProvider
    // from current recipients.
    // Else, Unfollow button is clicker from PWA toolbar and so remove current logged in user from recipients.
    if (isFollowersSectionUnfollowClicked) {
        recipient = getUpatedRecipients(followerTableProvider.selectedObjects, recipient);
    }
    else {
        recipient = getUpatedRecipients([loggedInUser], recipient);
    }

    // Adding addtional properties information.
    let additionalProperties = [{
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

    // Creating SOA input.
    return [{
        name: ruleName ? ruleName : '',
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
        listOfAdditionalProperties: additionalProperties
    }];
};

/**
 * Edit event
 *
 * @param {String} state - State of event like 'starting', 'canceling' etc.
 * @param {object} data - Data.
 * @param {object} vmo - View Model object which is getting edited.
 * @return {object} - Object contains updated message.
 *
 */
export let editEventAction = function( state, data, vmo ) {
    const newDataMessage = _.clone( data.message );
    const newDataIsActive = _.clone( data.isActive );

    if( state === 'starting' ) {
        // Storing value in prevDisplayValues before the start of editing.
        newDataMessage.prevDisplayValues[0] = newDataMessage.uiValue;
        newDataIsActive.prevDisplayValues[0] = newDataIsActive.dbValue;

        // Adding message and isActive properties to VMO props.
        vmo.props.message = newDataMessage;
        vmo.props.isActive = newDataIsActive;

        // Making message and isActive properties editable when 'Start Edit' is clicked.
        newDataMessage.isEditable = true;
        newDataMessage.isEnabled = true;

        newDataIsActive.isEditable = true;
        newDataIsActive.isEnabled = true;
    } else if( state === 'canceling' ) {
        // Restoring original values of properties before start of editing.
        // Make message and isActive properties isEditable false once 'Cancel Edit' is clicked.
        newDataMessage.uiValue = newDataMessage.prevDisplayValues[0];
        newDataMessage.dbValue = newDataMessage.prevDisplayValues[0];
        newDataMessage.isEditable = false;
        newDataMessage.isEnabled = false;

        newDataIsActive.dbValue = newDataIsActive.prevDisplayValues[0];
        newDataIsActive.uiValue = newDataIsActive.prevDisplayValues[0];
        newDataIsActive.isEditable = false;
        newDataIsActive.isEnabled = false;
    } else if ( state === 'saved' ) {
        // Make isActive property isEditable false after save is completed.
        newDataIsActive.isEditable = false;
        newDataIsActive.isEnabled = false;

        // If edit is happening in SUMMARY page then after save operation, close the Info panel if it is active
        if ( vmo.xrtType === 'SUMMARY' && appCtxSvc.ctx.activeToolsAndInfoCommand && appCtxSvc.ctx.activeToolsAndInfoCommand.commandId === 'Awp0ObjectInfo' ) {
            commandPanelService.activateCommandPanel( 'Awp0ObjectInfo', 'aw_toolsAndInfo' );
        } // Else if, edit is happening in info panel then after save, reset primary work area to show updated values.
        else if ( vmo.xrtType === 'INFO' ) {
            eventBus.publish( 'primaryWorkarea.reset' );
        }
    }
    return {
        message: newDataMessage,
        isActive: newDataIsActive
    };
};

export let getSaveHandler = function() {
    return saveHandler;
};


/**
 * Process the partial error in SOA response if there are any.
 *
 * @param {serviceData} serviceData - service data of createOrUpdateNotificationRules
 */
function processPartialErrors( serviceData ) {
    let msgObj = {
        msg: '',
        level: 0
    };

    if( serviceData.partialErrors ) {
        for( let inx = 0; inx < serviceData.partialErrors[ 0 ].errorValues.length; inx++ ) {
            msgObj.msg += serviceData.partialErrors[ 0 ].errorValues[ inx ].message;
            msgObj.msg += '<BR/>';
            msgObj.level = _.max( [ msgObj.level, serviceData.partialErrors[ 0 ].errorValues[ inx ].level ] );
        }
        messageService.showError( msgObj.msg );
    }
}

/**
 * Call the SOA createOrUpdateNotificationRules for modified Object in data Source
 *
 * @param {datasource} dataSource - Data source.
 * @returns {promise} Promise when modified Subscription get saved.
 */
saveHandler.saveEdits = function( dataSource ) {
    const deferred = awPromiseService.instance.defer();

    // Get all modified properties.
    const allModifiedObjects = dataSource.getAllModifiedPropertiesWithVMO();

    // Create createOrUpdateNotificationRules SOA Inputs for update.
    let updateNotificationRulesSOAInputs = [];

    _.forEach( allModifiedObjects, function( modifiedObject ) {
        const vmObject = _.get( modifiedObject, 'viewModelObject' );
        if( vmObject.type === 'ImanSubscription' ) {
            const modifiedViewModelProperties = _.get( modifiedObject, 'viewModelProps' );
            updateNotificationRulesSOAInputs.push( getUpdateSubscriptionSOAInput( vmObject, modifiedViewModelProperties ) );
        }
    } );

    const soaInput = {
        notificationRuleInfos: updateNotificationRulesSOAInputs
    };

    // Calling update SOA.
    soaService.postUnchecked( 'ProjectManagement-2022-06-ScheduleManagement',
        'createOrUpdateNotificationRules', soaInput ).then( function( serviceData ) {
        if( serviceData.partialErrors ) {
            processPartialErrors( serviceData );
            let error = null;
            deferred.reject( error );
            editHandlerService.cancelEdits();
        } else {
            deferred.resolve( serviceData );
        }
    } );

    return deferred.promise;
};

/**
 * Returns dirty bit.
 *
 * @returns {Boolean} isDirty bit
 */
saveHandler.isDirty = function() {
    return true;
};

/**
 * Get modified property value, if it is in list of modified properties.
 *
 * @param {String} oldValue - Old value of property
 * @param {String} propertyName - Name of property
 * @param {object} modifiedViewModelProperties - List of modified properties.
 * @returns {Boolean} isDirty bit
 */
function getUpdatedPropertyValue( oldValue, propertyName, modifiedViewModelProperties ) {
    const updatedProperty = modifiedViewModelProperties.find( ( property ) => property.propertyName === propertyName );
    return updatedProperty ? updatedProperty.dbValue : oldValue;
}

/**
 * Get SOA input for createOrUpdateNotificationRules SOA ( Cretae or Update use case )
 *
 * @param subscriptionToUpdate : Subscription object which needs update.
 * @param modifiedViewModelProperties: Modified properties
 */
let getUpdateSubscriptionSOAInput = function( subscriptionToUpdate, modifiedViewModelProperties ) {
    let notificationStructure = parseNoificationParameters( subscriptionToUpdate.props.handler_parameters.dbValues.length, subscriptionToUpdate.props.handler_parameters.dbValues );

    // Non-editable fields
    const additionalEmails = notificationStructure.email_recipients;
    const notificationSubject = notificationStructure.subject;
    const notificationCondition = notificationStructure.notification_condition;
    const recipientUids = notificationStructure.recipients;
    const subscriber = clientDataModel.getObject( subscriptionToUpdate.props.subscriber.dbValue );
    const target = clientDataModel.getObject( subscriptionToUpdate.props.target.dbValue );
    const eventTypeObject = clientDataModel.getObject( subscriptionToUpdate.props.event_type.dbValue );
    const ruleType = eventTypeObject.props.eventtype_id.dbValues[0];

    let recipient = [];
    if ( recipientUids && recipientUids.length > 0 ) {
        for ( let i = 0; i < recipientUids.length; i++ ) {
            const recObject = clientDataModel.getObject( recipientUids[i] );
            recipient.push( {
                uid: recObject.uid,
                type: recObject.type
            } );
        }
    }

    // If expiration_date is not NULLDATA, the subscription is Inactive.
    let isActive = true;
    if ( subscriptionToUpdate.props.expiration_date.dbValue > 0 ) {
        isActive = false;
    }

    // Editable fields
    isActive = getUpdatedPropertyValue( isActive, 'isActive', modifiedViewModelProperties );
    const ruleName  = getUpdatedPropertyValue( subscriptionToUpdate.props.fnd0Name.dbValues[0], 'fnd0Name', modifiedViewModelProperties );
    const notificationMessage = getUpdatedPropertyValue( notificationStructure.message, 'message', modifiedViewModelProperties );

    let additionalProperties = [ {
        name: EXTRA_ARG_EMAIL_SUBJECT,
        values: [notificationSubject]
    },
    {
        name: EXTRA_ARG_EMAIL_TEXT,
        values: [notificationMessage]
    },
    {
        name: EXTRA_CONDITIONS,
        values: [notificationCondition]
    },
    {
        name: EXTRA_ARG_EMAIL_RECIPIENTS,
        values: [additionalEmails]
    }];

    // SOA input structure
    return {
        name: ruleName ? ruleName : '',
        ruleType: ruleType,
        status: isActive,
        update: true,
        target: {
            uid: target.uid,
            type: target.type
        },
        subscriber: {
            uid: subscriber.uid,
            type: subscriber.type
        },
        recipient: recipient,
        listOfAdditionalProperties: additionalProperties
    };
};

/**
 * Validate whether provided flag is Parameter or not.
 *
 * @param flag : Input flag
 * @return paramOk Is flag parameter or not.
 */
var isParameterFlag = function( flag ) {
    let paramOk = false;
    if ( flag === NOTIFICATION_PARAMETER_SUBJECT ) {
        paramOk = true;
    } else if ( flag === NOTIFICATION_PARAMETER_MESSAGE ) {
        paramOk = true;
    } else if ( flag === NOTIFICATION_PARAMETER_RECIPIENTS ) {
        paramOk = true;
    } else if ( flag === NOTIFICATION_PARAMETER_EMAIL_RECIPIENTS ) {
        paramOk = true;
    } else if ( flag === NOTIFICATION_PARAMETER_CONDITION ) {
        paramOk = true;
    } else if ( flag === NOTIFICATION_PARAMETER_DELIVERY_STATUS ) {
        paramOk = true;
    }
    return paramOk;
};

/**
 * Parse the Imansubscription object specially its handler_arguments
 *
 * @param paramCount : Count of arguments
 * @param parameters : Arguments
 * @return notificationStructure Structure containing values from handler arguments.
 */
 export let parseNoificationParameters = function (paramCount, parameters) {
    let paramPtr = 0;
    let notificationStructure = {
        subject: '',
        message: '',
        email_recipients: '',
        notification_condition: '',
        recipients: []
    };

    // Process here
    while ( paramPtr < paramCount ) {
        if ( parameters[paramPtr] === NOTIFICATION_PARAMETER_SUBJECT ) {
            if ( ++paramPtr >= paramCount ) {
                continue;
            }
            if ( isParameterFlag( parameters[paramPtr] ) ) {
                break;
            }
            let textStr = '';
            while ( paramPtr < paramCount ) {
                textStr += parameters[paramPtr];
                if ( ++paramPtr >= paramCount ) {
                    continue;
                }

                if ( isParameterFlag( parameters[paramPtr] ) ) {
                    break;
                }
            }
            notificationStructure.subject = textStr;
            if ( paramPtr >= paramCount ) {
                continue;
            }
        } else if ( parameters[paramPtr] === NOTIFICATION_PARAMETER_MESSAGE ) {
            if ( ++paramPtr >= paramCount ) {
                continue;
            }
            if ( isParameterFlag( parameters[paramPtr] ) ) {
                break;
            }
            let textStr = '';
            while ( paramPtr < paramCount ) {
                textStr += parameters[paramPtr];
                if ( ++paramPtr >= paramCount ) {
                    continue;
                }

                if ( isParameterFlag( parameters[paramPtr] ) ) {
                    break;
                }
            }
            notificationStructure.message = textStr;
            if ( paramPtr >= paramCount ) {
                continue;
            }
        } else if ( parameters[paramPtr] === NOTIFICATION_PARAMETER_RECIPIENTS ) {
            if ( ++paramPtr >= paramCount ) {
                continue;
            }
            if ( isParameterFlag( parameters[paramPtr] ) ) {
                break;
            }
            while ( paramPtr < paramCount ) {
                notificationStructure.recipients.push( parameters[paramPtr] );

                if ( ++paramPtr >= paramCount ) {
                    continue;
                }

                if ( isParameterFlag( parameters[paramPtr] ) ) {
                    break;
                }
            } // end of while loop
        } else if ( parameters[paramPtr] === NOTIFICATION_PARAMETER_EMAIL_RECIPIENTS ) {
            if ( ++paramPtr >= paramCount ) {
                continue;
            }
            notificationStructure.email_recipients = parameters[paramPtr];
            if ( notificationStructure.email_recipients === null || notificationStructure.email_recipients === undefined ) {
                notificationStructure.email_recipients = '';
            }
            if ( ++paramPtr >= paramCount ) {
                continue;
            }
        } else if ( parameters[paramPtr] === NOTIFICATION_PARAMETER_CONDITION ) {
            if ( ++paramPtr >= paramCount ) {
                continue;
            }
            notificationStructure.notification_condition = parameters[paramPtr];
            if ( notificationStructure.notification_condition === null || notificationStructure.notification_condition === undefined ) {
                notificationStructure.notification_condition = '';
            }
            if ( ++paramPtr >= paramCount ) {
                continue;
            }
        } else if ( parameters[paramPtr] === NOTIFICATION_PARAMETER_DELIVERY_STATUS ) {
            // Don't include NOTIFICATION_PARAMETER_DELIVERY_STATUS since it's for
            // internal use only
            paramPtr += 2;
            continue;
        }
        else {
            break;
        }
    } // end of parameter cycle

    return notificationStructure;
};

/**
 * Create Inputs for createOrUpdateNotificationRules SOA for Change Owner operation
 *
 * @param subscriptions : List of subscriptions object whose subscriber needs to get changed
 * @param transferTo : New subscriber
 * @return  Input for createOrUpdateNotificationRules SOA.
 */
export let getChangeOwnerUpdateSubscriptionSOAInputs = function (subscriptions, transferTo) {
    let inputs = [];

    subscriptions.forEach((subscriptionObject) => {
        // Parse handler_parameters property of subscription object to get notification data.
        const notificationStructure = parseNoificationParameters(subscriptionObject.props.handler_parameters.dbValues.length, subscriptionObject.props.handler_parameters.dbValues);

        // Get additional emails information.
        const additionalEmails = notificationStructure.email_recipients;

        // Get condition information.
        const notificationCondition = notificationStructure.notification_condition;

        // Get message information.
        const notificationMessage = notificationStructure.message;

        // Get subject information.
        const notificationSubject = notificationStructure.subject;

        // Get event type information.
        let eventTypeObject = clientDataModel.getObject(subscriptionObject.props.event_type.dbValue);

        // Get rule name.
        let ruleName = subscriptionObject.props.fnd0Name.dbValues[0];

        // Get rule type from event object.
        let ruleType = eventTypeObject.props.eventtype_id.dbValues[0];

        // If expiration_date is not NULLDATA, the subscription is Inactive.
        let isActive = true;
        if (subscriptionObject.props.expiration_date.dbValue > 0) {
            isActive = false;
        }

        let isUpdate = true;

        // Get target and subscriber information.
        let target = clientDataModel.getObject(subscriptionObject.props.target.dbValue);
        let previousSubscriber = clientDataModel.getObject(subscriptionObject.props.subscriber.dbValue);

        // Get and load recipients.
        let recipientUids = notificationStructure.recipients;

        let recipient = [];
        recipient.push(transferTo);

        if (recipientUids && recipientUids.length > 0) {
            for (let i = 0; i < recipientUids.length; i++) {
                let recObject = clientDataModel.getObject(recipientUids[i]);
                let userInfo = {
                    uid: recObject.uid,
                    type: recObject.type
                };
                recipient.push(userInfo);
            }
        }

        // Get updated recipients i.e. remove selected recipients objects from current recipients.
        recipient = getUpatedRecipients([previousSubscriber], recipient);

        // Adding addtional properties information.
        let additionalProperties = [ {
                name: EXTRA_ARG_EMAIL_SUBJECT,
                values: [notificationSubject]
            },
            {
                name: EXTRA_ARG_EMAIL_TEXT,
                values: [notificationMessage]
            },
            {
                name: EXTRA_CONDITIONS,
                values: [notificationCondition]
            },
            {
                name: EXTRA_ARG_EMAIL_RECIPIENTS,
                values: [additionalEmails]
            },
            {
                name: EXTRA_ARG_CHANGE_OWNER,
                values: [transferTo.uid]
            }];

        // Creating SOA input.
        const input = {
            name: ruleName ? ruleName : "",
            ruleType: ruleType,
            status: isActive,
            update: isUpdate,
            target:
            {
                uid: target.uid,
                type: target.type
            },
            subscriber: previousSubscriber,
            recipient: recipient,
            listOfAdditionalProperties: additionalProperties
        };

        inputs.push(input);
    });
    return {
        inputs: inputs
    };
};

export default exports = {
    populateNotificationData,
    populateFollowersDataProvider,
    updateIsActive,
    getUpatedRecipients,
    getInformationToUnfollow,
    getUnfollowCommandSOAInput,
    editEventAction,
    getSaveHandler,
    parseNoificationParameters,
    getChangeOwnerUpdateSubscriptionSOAInputs
};
