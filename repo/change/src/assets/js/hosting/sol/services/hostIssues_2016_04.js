// Copyright (c) 2022 Siemens

/**
 * @module js/hosting/sol/services/hostIssues_2016_04
 * @namespace hostIssues_2016_04
 */
import hostFactorySvc from 'js/hosting/hostFactoryService';
import AwStateService from 'js/awStateService';
import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import dms from 'soa/dataManagementService';
import changeCmdSvc from 'js/Cm1ChangeCommandService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import browserUtils from 'js/browserUtils';
import logger from 'js/logger';
import hostServices from 'js/hosting/hostConst_Services';

/**
 * Return string for create issue command
 */
var CREATE_ISSUE_COMMAND = 'create_issue';

/**
 * Return string for edit issue command
 */
var EDIT_ISSUE_COMMAND = 'edit_issue';

/**
 * flag used to turn on trace level logging
 */
var _debug_logIssuesActivity = browserUtils.getWindowLocationAttributes().logIssuesActivity !== undefined;

/**
 * Have we seen the create change panel yet?
 */
var _haveSeenCm1ShowCreateChange = false;

/**
 * The event subscription handle for createChangeObject
 */
var _createChangeEventSub;

/**
 * The event subscription handle for createChange Panel close event
 */
var _createChangePanelCloseEventSubscription;

/**
 * The event subscription handle for full screen mode change event
 */
var _fullScreenEventSubscription;

/**
 * Name token of allChanges sublocation
 */
var CHANGES = 'showChanges';

/**
 * The parameter name to use for passing a supplied creation key during a host_integration originated create
 * change request.
 */
var HOST_REQUEST_KEY = 'HostRequestKey';

/**
 * The parameter name to use for passing a supplied Issue type name during a host_integration originated
 * create change request.
 */
var ISSUE_TYPE_NAME = 'IssueTypeName';

/**
 * The name used for a local context related to creating Issues in hosted mode.
 */
var CREATE_ISSUE_CTX_NAME = 'CreateIssueHostedMode';

/**
 * Return string for for host create issue success
 */
var CREATE_ISSUE_SUCCESSFUL = 'Issue_Created';

/**
 * Return string for for host create issue failure or cancel
 */
var CREATE_ISSUE_CANCELLED = 'Issue_Create_Cancelled';

/**
 * Return string for key name for the issue type name command argument
 */
var ISSUETYPE_KEY_NAME = 'IssueTypeName';

/**
 * Return string for the default type name when create an issue object
 */

var ISSUETYPE_DEFAULT = 'IssueReport';

/**
 * Return string for key name for the edit issue uid command argument
 */
var UID_KEY_NAME = 'uid';

// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------
// CreateIssueResponseProxy
// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------

/**
 * This class is used by the 'client' to invoke with the service implementation on the 'host'.
 *
 * @constructor
 * @memberof hostIssues_2016_04
 * @extends hostFactoryService.BaseCallableService
 */
var CreateIssueResponseProxy = function() {
    hostFactorySvc.getProxy().call( this,
        hostServices.HS_ISSUES_CREATE_RESPONSE,
        hostServices.VERSION_2016_04 );
};

CreateIssueResponseProxy.prototype = hostFactorySvc.extendProxy();

/**
 * Process outgoing 'event' type call to the host.
 *
 * @function fireHostEvent
 * @memberof hostIssues_2016_04.CreateIssueResponseProxy
 *
 * @param {CreateIssueResponseMsg} inputData - Data object who's properties define data {in whatever form
 * the implementation is expecting) to process into a call to the host-side service.
 */
CreateIssueResponseProxy.prototype.fireHostEvent = function( inputData ) {
    var payload = JSON.stringify( inputData );

    this._invokeHostEvent( payload );
};

// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------
// IssueCommandsMsg
// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------

/**
 * The service contract which sends the open request info to the host via {@link DragAndDropProxy}.
 * <P>
 * The message has a list of targets to be opened. Representation is similar to the selection service
 * contract.
 *
 * @constructor
 * @memberof hostIssues_2016_04
 * @extends hostFactorySvc.BaseDataContractImpl
 *
 * @param {String} jsonData - (Optional) String from the 'host' to use when initializing the message object.
 */
var IssueCommandsMsg = function( jsonData ) {
    hostFactorySvc.getDataContract().call( this, hostServices.VERSION_2016_04 );

    if( jsonData ) {
        _.assign( this, JSON.parse( jsonData ) );
    }
};

IssueCommandsMsg.prototype = hostFactorySvc.extendDataContract();

/**
 * Get the hostRequestKey.
 *
 * @memberof hostIssues_2016_04.IssueCommandsMsg
 *
 * @return {String} Property value.
 */
IssueCommandsMsg.prototype.getHostRequestKey = function() {
    return _.get( this, 'HostRequestKey', null );
};

/**
 * Set the hostRequestKey.
 *
 * @memberof hostIssues_2016_04.IssueCommandsMsg
 *
 * @param {String} value - Property value.
 */
IssueCommandsMsg.prototype.setHostRequestKey = function( value ) {
    this.HostRequestKey = value;
};

/**
 * Get the issueCommand.
 *
 * @memberof hostIssues_2016_04.IssueCommandsMsg
 *
 * @return {String} Property value.
 */
IssueCommandsMsg.prototype.getIssueCommand = function() {
    return _.get( this, 'IssueCommand', null );
};

/**
 * Set the issueCommand.
 *
 * @memberof hostIssues_2016_04.IssueCommandsMsg
 *
 * @param {String} value - Property value.
 */
IssueCommandsMsg.prototype.setIssueCommand = function( value ) {
    this.IssueCommand = value;
};

/**
 * Get key/value pairs representing arguments for the given issue command.
 *
 * @memberof hostIssues_2016_04.IssueCommandsMsg
 *
 * @return {PairArray} Property value.
 */
IssueCommandsMsg.prototype.getCommandArguments = function() {
    return _.get( this, 'CommandArguments', null );
};

/**
 * Set key/value pairs representing arguments for the given issue command.
 *
 * @memberof hostIssues_2016_04.IssueCommandsMsg
 *
 * @param {PairArray} value - Property value.
 */
IssueCommandsMsg.prototype.setCommandArguments = function( value ) {
    this.CommandArguments = value;
};

// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------
// CreateIssueResponseMsg
// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------

/**
 * The service contract which sends the open request info to the host via {@link DragAndDropProxy}.
 * <P>
 * The message has a list of targets to be opened. Representation is similar to the selection service
 * contract.
 *
 * @constructor
 * @memberof hostIssues_2016_04
 * @extends hostFactorySvc.BaseDataContractImpl
 *
 * @param {String} jsonData - (Optional) String from the 'host' to use when initializing the message object.
 */
var CreateIssueResponseMsg = function( jsonData ) {
    hostFactorySvc.getDataContract().call( this, hostServices.VERSION_2016_04 );

    if( jsonData ) {
        _.assign( this, JSON.parse( jsonData ) );
    }
};

CreateIssueResponseMsg.prototype = hostFactorySvc.extendDataContract();

/**
 * Get the object to generate a ticket against.
 *
 * @memberof hostIssues_2016_04.CreateIssueResponseMsg
 *
 * @return {InteropObjectRef} Property value.
 */
CreateIssueResponseMsg.prototype.getIssueObject = function() {
    return _.get( this, 'IssueObj', null );
};

/**
 * Set the object to generate a ticket against.
 *
 * @memberof hostIssues_2016_04.CreateIssueResponseMsg
 *
 * @param {InteropObjectRef} value - Property value.
 */
CreateIssueResponseMsg.prototype.setIssueObject = function( value ) {
    this.IssueObj = value;
};

/**
 * Get the createIssueRequestId.
 *
 * @memberof hostIssues_2016_04.CreateIssueResponseMsg
 *
 * @return {String} Property value.
 */
CreateIssueResponseMsg.prototype.getCreateIssueRequestId = function() {
    return _.get( this, 'CreateIssueRequestId', null );
};

/**
 * Set the hostRequestKey.
 *
 * @memberof hostIssues_2016_04.CreateIssueResponseMsg
 *
 * @param {String} value - Property value.
 */
CreateIssueResponseMsg.prototype.setCreateIssueRequestId = function( value ) {
    this.CreateIssueRequestId = value;
};

/**
 * Get the returnCode.
 *
 * @memberof hostIssues_2016_04.CreateIssueResponseMsg
 *
 * @return {String} Property value.
 */
CreateIssueResponseMsg.prototype.getReturnCode = function() {
    return _.get( this, 'ReturnCode', null );
};

/**
 * Set the returnCode.
 *
 * @memberof hostIssues_2016_04.CreateIssueResponseMsg
 *
 * @param {String} value - Property value.
 */
CreateIssueResponseMsg.prototype.setReturnCode = function( value ) {
    this.ReturnCode = value;
};

// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------
// CreateIssue Related functions
// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------

/**
 * The BIO handler for the client side Create Issue command. The purpose of this command is to cause the AWC
 * to create an IssueReport (or derived type) object for the host. The CreateIssueResponseProxy BIO service
 * call will be made back to the host to report back the results of this handler.
 *
 * @param {INativeCommandContext} cmdContext - current command context
 * @param {String} issueCreateKey - the host provided create key
 * @param {MapStringToString} commandArguments the create issue command arguments
 */
function _executeCreateCmd( cmdContext, issueCreateKey, commandArguments ) {
    if( _debug_logIssuesActivity ) {
        logger.info( 'hostIssues: ' + 'Entered CreateIssue::executeCreateCmd' );
    }

    // Verify that the proper command argument has been passed. For the create issue command the required
    // argument key name is "IssueTypeName" and the value is expected to be "IssueReport" or the name of a
    // derived type from "IssueReport"
    var issueTypeName = commandArguments[ ISSUETYPE_KEY_NAME ];

    if( !issueTypeName ) {
        // If the caller did not supply a type name then we shall default to "IssueReport"
        issueTypeName = ISSUETYPE_DEFAULT;
    }

    // We are going to register our own context to hold the Issue object typename and the host request key.
    // We will use this data when handling the create change object events.

    var jso = {};

    jso[ ISSUE_TYPE_NAME ] = issueTypeName;
    jso[ HOST_REQUEST_KEY ] = issueCreateKey;

    appCtxSvc.registerCtx( CREATE_ISSUE_CTX_NAME, jso );

    var currentSubLocationJSO = appCtxSvc.getCtx( 'locationContext' );
    var subLocStr = {};
    if( currentSubLocationJSO ) {
        subLocStr = currentSubLocationJSO[ 'ActiveWorkspace:SubLocation' ];
    }

    if( subLocStr === CHANGES ) {
        if( _debug_logIssuesActivity ) {
            logger.info( 'hostIssues: ' + 'showChanges page is already up.' );
        }

        var currentCommandObj = appCtxSvc.getCtx( 'activeToolsAndInfoCommand' );

        var currCmd = currentCommandObj ? currentCommandObj.commandId : '';

        if( currCmd === 'Cm1ShowCreateChange' ) {
            if( _debug_logIssuesActivity ) {
                logger.info( 'hostIssues: ' + 'Current commandId is Cm1ShowCreateChange.' );
            }

            _createNewIssue();
        } else {
            if( _debug_logIssuesActivity ) {
                logger.info( 'hostIssues: ' + 'CreateChange panel is not up yet.' );
            }

            //IJSO stateParams = appCtxSvc.getCtx( "state" ).get( "params" );  //$NON-NLS-2$
            //stateParams.setString( COMMAND_ARGS, issueTypeName );
            _openCreateChangePanel( /* stateParams, */ issueTypeName );
        }

        _onShowChangesShown();
    } else {
        // Go switch locations to the showChanges page.
        if( _debug_logIssuesActivity ) {
            logger.info( 'hostIssues: ' + 'We must bring up the showChanges page.' );
        }

        _switchToshowChangesPage( issueTypeName );
    }
}

/**
 * Fire event to cause the already open CreateChange panel to reopen using the object type name we put in
 * our CreateIssueHostedMode application context.
 */
function _createNewIssue() {
    if( _debug_logIssuesActivity ) {
        logger.info( 'hostIssues: ' + '_createNewIssue entered.' );
    }
    eventBus.publish( 'hostedModeCreateChange.IssueReport', {} );
}

/**
 * Open the CreateChange panel on the showChanges page.
 *
 * @param {String} issueTypeName - the object type name to be created
 */
function _openCreateChangePanel( issueTypeName ) {
    if( _debug_logIssuesActivity ) {
        logger.info( 'hostIssues: ' + '_openCreateChangePanel entered. About to call changeCmdSvc.openCreateChangePanel' );
    }
    var params = {
        commandID: 'Cm1ShowCreateChange',
        cmdArg: issueTypeName
    };

    changeCmdSvc.openCreateChangePanel( 'Cm1ShowCreateChange', 'aw_toolsAndInfo', params );
}

/**
 * Process a request to create an issue.
 *
 * @param {IModelObject} issueModelObj - the IssueReport object that was created
 * @param {String} issueCreateKey - the host create key
 */
function _processCreatedIssue( issueModelObj, issueCreateKey ) {
    if( _debug_logIssuesActivity ) {
        logger.info( 'hostIssues: ' + '_processCreatedIssue entered.' );
    }

    var issueObjRef = {};
    var createRC;

    // If we have an IssueReport object then the request was successful
    if( issueModelObj ) {
        if( _debug_logIssuesActivity ) {
            logger.info( 'hostIssues: ' + 'issueModelObj is not null.' );
        }

        issueObjRef.Data = issueModelObj.uid;
        issueObjRef.Type = issueModelObj.type;

        createRC = CREATE_ISSUE_SUCCESSFUL;
    } else {
        if( _debug_logIssuesActivity ) {
            logger.info( 'hostIssues: ' + 'issueModelObj is null.' );
        }

        createRC = CREATE_ISSUE_CANCELLED;
    }

    // Return the CreateIssue response to host
    var responseMsg = exports.createCreateIssueResponseMsg();

    responseMsg.setIssueObject( issueObjRef );
    responseMsg.setCreateIssueRequestId( issueCreateKey );
    responseMsg.setReturnCode( createRC );

    exports.createCreateIssueResponseProxy().fireHostEvent( responseMsg );
}

/**
 * Cancel the create issue operation.
 */
function _cancelCreateIssue() {
    if( _debug_logIssuesActivity ) {
        logger.info( 'hostIssues: ' + '_cancelCreateIssue entered.' );
    }

    var createIssueContext = appCtxSvc.getCtx( CREATE_ISSUE_CTX_NAME );

    if( createIssueContext ) {
        if( _debug_logIssuesActivity ) {
            logger.info( 'hostIssues: ' + 'The createIssueContext is registered.' );
        }

        var issueCreateKey = createIssueContext[ HOST_REQUEST_KEY ];

        // Clear our flag that tracks whether we left the create issue.
        _haveSeenCm1ShowCreateChange = false;

        _processCreatedIssue( null, issueCreateKey );

        appCtxSvc.unRegisterCtx( CREATE_ISSUE_CTX_NAME );
    }
}

/**
 * On create host requested change object create event.
 *
 * @param {Object} eventData - the event data
 */
function _onIssueCreatedEventJS( eventData ) {
    if( _debug_logIssuesActivity ) {
        logger.info( 'hostIssues: ' + '_onIssueCreatedEventJS entered.' );
    }

    // Only process this event if our createIssue context exists.
    var createIssueContext = appCtxSvc.getCtx( CREATE_ISSUE_CTX_NAME );

    if( createIssueContext ) {
        if( _debug_logIssuesActivity ) {
            logger.info( 'hostIssues: ' + 'The createIssueContext is registered.' );
        }

        var issueModelObj = eventData.createdChangeObject;
        var issueCreateKey = createIssueContext[ HOST_REQUEST_KEY ];

        // Clear our flag that tracks whether we left the create issue.
        _haveSeenCm1ShowCreateChange = false;

        setTimeout( function() {
            _processCreatedIssue( issueModelObj, issueCreateKey );
            _unSubscribeAllEvents();
        }, 2000 );
    }
}

/**
 * Subscribe to the event.
 *
 * @return {Object} Event subscription definition.
 */
function _subscribeCreateChangeObjectSoaEventJS() {
    return eventBus.subscribe( 'changeObjectCreated', _onIssueCreatedEventJS );
}

/**
 * Unsubscribe listening for an Event
 *
 * @param {Object} subDef Event subscription definition.
 */
function _unsubscribeEventJS( subDef ) {
    eventBus.unsubscribe( subDef );
}

/**
 * Subscribe for change tool and info panel close events.
 */
function _subscribeCreateChangePanelCloseEvents() {
    if( _debug_logIssuesActivity ) {
        logger.info( 'hostIssues: ' + '_subscribeCreateChangePanelCloseEvents entered.' );
    }
    if( !_createChangePanelCloseEventSubscription ) {
        _createChangePanelCloseEventSubscription = _subscribeActiveToolsAndInfo();
    }

    if( !_fullScreenEventSubscription ) {
        _fullScreenEventSubscription = _subscribeFullScreenChangeEventJS();
    }
}

/**
 * UnSubscribe from listening for all of our events and unregister our context.
 */
function _unSubscribeAllEvents() {
    if( _debug_logIssuesActivity ) {
        logger.info( 'hostIssues: ' + '_unSubscribeAllEvents entered.' );
    }

    if( _createChangePanelCloseEventSubscription ) {
        _unsubscribeEventJS( _createChangePanelCloseEventSubscription );

        _createChangePanelCloseEventSubscription = null;
    }

    if( _fullScreenEventSubscription ) {
        _unsubscribeEventJS( _fullScreenEventSubscription );
        _fullScreenEventSubscription = null;
    }

    if( _createChangeEventSub ) {
        _unsubscribeEventJS( _createChangeEventSub );
        _createChangeEventSub = null;
    }

    _haveSeenCm1ShowCreateChange = false;

    var createIssueContext = appCtxSvc.getCtx( CREATE_ISSUE_CTX_NAME );

    if( createIssueContext ) {
        appCtxSvc.unRegisterCtx( CREATE_ISSUE_CTX_NAME );
    }
}

/**
 * If we see a panel is opened once (we have seen the commandId Cm1ShowCreateChange) then cancel the create
 * issue and unregister event listeners.
 *
 * @param {Object} eventData - appCtx.register event data
 */
function _onActiveToolsAndInfoCmdClicked( eventData ) {
    if( eventData.name === 'activeToolsAndInfoCommand' ) {
        if( _debug_logIssuesActivity ) {
            logger.info( 'hostIssues: ' + 'Event name is activeToolsAndInfoCommand.' );
        }

        var bNeedtoCancelCreateIssue = false;
        if( _haveSeenCm1ShowCreateChange ) {
            if( _debug_logIssuesActivity ) {
                logger.info( 'hostIssues: ' + 'We had already shown the showChanges page. so we must cancel the createIssue request.' );
            }

            bNeedtoCancelCreateIssue = true;
        } else if( _.get( eventData, 'value.commandId' ) === 'Cm1ShowCreateChange' ) {
            if( _debug_logIssuesActivity ) {
                logger.info( 'hostIssues: ' + 'commandId is Cm1ShowCreateChange, therefore the create issue panel is up.' );
            }

            _haveSeenCm1ShowCreateChange = true;
        }

        if( bNeedtoCancelCreateIssue ) {
            _cancelCreateIssue();
            _unSubscribeAllEvents();
        }
    }
}

/**
 * Subscribing to appCtx.register, to determine if Tools and Info Panel is changing
 *
 * @return {Object} subscription
 */
function _subscribeActiveToolsAndInfo() {
    return eventBus.subscribe( 'appCtx.register', _onActiveToolsAndInfoCmdClicked );
}

/**
 * Event handler for the full screen (commandBarResized) change event.
 */
function _onFullScreenCmdClicked() {
    if( _debug_logIssuesActivity ) {
        logger.info( 'hostIssues: ' + '_onFullScreenCmdClicked entered.' );
    }
    _cancelCreateIssue();
    _unSubscribeAllEvents();
}

/**
 * Subscribe to commandBarResized (full screen) change event. We must cancel the issue creation task if the
 * user changes the full screen state during the processing of the create task.
 *
 * @return {Object} Event subscription definition.
 */
function _subscribeFullScreenChangeEventJS() {
    return eventBus.subscribe( 'commandBarResized', _onFullScreenCmdClicked );
}

/**
 * Event handler for the full screen (commandBarResized) change event.
 */
function _onShowChangesShown() {
    if( _debug_logIssuesActivity ) {
        logger.info( 'hostIssues: ' + '_onShowChangesShown entered.' );
    }

    if( !_createChangeEventSub ) {
        _createChangeEventSub = _subscribeCreateChangeObjectSoaEventJS();
    }

    _subscribeCreateChangePanelCloseEvents();
}

/**
 * Switch to the showChanges location
 *
 * @param {String} issueTypeName type name of issue object to create.
 */
function _switchToshowChangesPage( issueTypeName ) {
    AwStateService.instance.go( 'showChanges' ).then( function() {
        setTimeout( function() {
            _openCreateChangePanel( issueTypeName );
            _onShowChangesShown();
        }, 1000 );
    }, function( err ) {
        /**
         * Check if we did not 'go' as smoothly as intended. This happens when the current location has
         * a 'leaveHandler' on it and that handler will allow (or not) the eventual transition to the
         * desired location.
         * <P>
         * Note: We only want to listen for the very next transition. If it is not 'showChanged',
         * process a 'cancel' back to the host.
         */
        if( err.message === 'transition prevented' ) {
            // var deregisterListener = AwRootScopeService.instance.$on( 'AwStateService.instanceChangeStart', function( event, toState, toParams, fromState, fromParams, options ) {
            //     deregisterListener();
            //     if( toState.name === 'showChanges' ) {
            //         _onShowChangesShown();
            //     } else {
            //         logger.error( 'Error during switch to showChanges: ' + 'to: ' + toState.name );
            //         _cancelCreateIssue();
            //         _unSubscribeAllEvents();
            //     }
            // } );
        } else {
            logger.error( 'Error during switch to show create: ' + 'err: ' + err );
            _cancelCreateIssue();
            _unSubscribeAllEvents();
        }
    } );
}

// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------
// EditIssue Related functions
// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------

/**
 * Create an edit operation for the IssueReport and schedule it for execution.
 *
 * @param {IModelObject} modelObj - The object to go edit.
 */
function _goEditObject( modelObj ) {
    if( modelObj ) {
        AwStateService.instance.go( 'com_siemens_splm_clientfx_tcui_xrt_showObject', {
            uid: modelObj.uid,
            edit: true
        } ).then( function() {
            //
        } );
    }
}

/**
 * Bring up the showObject page in edit mode for the given issue object
 *
 * @param {MapStringToString} commandArguments - the edit issue command arguments
 */
function _editIssue( commandArguments ) {
    if( _debug_logIssuesActivity ) {
        logger.info( 'hostIssues: ' + '_editIssue entered' ); //$NON-NLS-1$
    }

    // Verify that the proper command argument has been passed. For the edit issue command the required
    // argument key name is "UID" and the value is expected to be uid of the object to be edited.
    var uid = commandArguments[ UID_KEY_NAME ];

    if( !uid ) {
        // The caller did not send us a uid. So, we will ignore the request
        return;
    }

    // Get valid model object for uid
    dms.loadObjects( [ uid ] ).then( function() {
        _goEditObject( cdm.getObject( uid ) );
    } );
}

// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------
// IssueCommandsSvc
// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------

/**
 *  Hosting service to ...
 *
 *  @constructor
 *  @memberof hostIssues_2016_04
 *  @extends hostFactoryService.BaseCallableService
 */
var IssueCommandsSvc = function() {
    hostFactorySvc.getCallableService().call( this,
        hostServices.CS_ISSUES_EXECUTECOMMAND_SVC,
        hostServices.VERSION_2016_04 );
};

IssueCommandsSvc.prototype = hostFactorySvc.extendCallableService();

/**
 * This is an incoming call to this service. Trigger the related event handlers.
 *
 * @function handleIncomingEvent
 * @memberof hostIssues_2016_04.IssueCommandsSvc
 *
 * @param {String} jsonData - JSON encoded payload from the host.
 */
IssueCommandsSvc.prototype.handleIncomingEvent = function( jsonData ) {
    try {
        var msg = exports.createIssueCommandsMsg( jsonData );

        if( msg ) {
            var hostRequestKey = msg.getHostRequestKey();
            var issueCommand = msg.getIssueCommand();
            var commandArguments = msg.getCommandArguments();

            // Move vector of String pairs into a HashMap for easier processing.
            var cmdArgumentsMap = {};

            if( commandArguments ) {
                _.forEach( commandArguments, function( cmdArg ) {
                    cmdArgumentsMap[ cmdArg.Key ] = cmdArg.Value;
                } );
            }

            if( issueCommand ) {
                switch ( issueCommand.toLowerCase() ) {
                    case CREATE_ISSUE_COMMAND:
                        _executeCreateCmd( {}, hostRequestKey, cmdArgumentsMap );
                        break;

                    case EDIT_ISSUE_COMMAND:
                        _editIssue( cmdArgumentsMap );
                        break;
                    default:
                        break;
                }
            }
        }
    } catch ( ex ) {
        logger.error( ex );
    }
};

// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------
// Public Functions
// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------

var exports = {};

/**
 * Return a new instance of this class.
 *
 * @memberof hostIssues_2016_04
 *
 * @returns {IssueCommandsSvc} New instance of the service message API object.
 */
export let createIssueCommandsSvc = function() {
    return new IssueCommandsSvc();
};

/**
 * Return a new instance of this class.
 *
 * @memberof hostIssues_2016_04
 *
 * @returns {CreateIssueResponseProxy} New instance of the service message API object.
 */
export let createCreateIssueResponseProxy = function() {
    return new CreateIssueResponseProxy();
};

/**
 * Return a new instance of this class.
 *
 * @memberof hostIssues_2016_04
 *
 * @param {String} payload - (Optional) String from the 'host' to use when initializing the message object.
 *
 * @returns {IssueCommandsMsg} New instance of the service message object.
 */
export let createIssueCommandsMsg = function( payload ) {
    return new IssueCommandsMsg( payload );
};

/**
 * Return a new instance of this class.
 *
 * @memberof hostIssues_2016_04
 *
 * @param {String} payload - (Optional) String from the 'host' to use when initializing the message object.
 *
 * @returns {CreateIssueResponseMsg} New instance of the service message object.
 */
export let createCreateIssueResponseMsg = function( payload ) {
    return new CreateIssueResponseMsg( payload );
};

/**
 * Register any client-side (CS) services (or other resources) contributed by this module.
 *
 * @memberof hostTheme_2014_02
 */
export let registerHostingModule = function() {
    exports.createIssueCommandsSvc().register();
};

export default exports = {
    createIssueCommandsSvc,
    createCreateIssueResponseProxy,
    createIssueCommandsMsg,
    createCreateIssueResponseMsg,
    registerHostingModule
};
