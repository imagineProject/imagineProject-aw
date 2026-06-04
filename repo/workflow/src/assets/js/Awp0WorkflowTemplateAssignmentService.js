// Copyright (c) 2022 Siemens

/**
 * This implements the workflow template assignment related methods.
 *
 * @module js/Awp0WorkflowTemplateAssignmentService
 */
import AwPromiseService from 'js/awPromiseService';
import appCtxSvc from 'js/appCtxService';
import clientDataModel from 'soa/kernel/clientDataModel';
import Awp0WorkflowDesignerUtils from 'js/Awp0WorkflowDesignerUtils';
import uwPropertySvc from 'js/uwPropertyService';
import viewModelObjectService from 'js/viewModelObjectService';
import awp0TasksUtils from 'js/Awp0TasksUtils';
import soaSvc from 'soa/kernel/soaService';
import editService from 'js/Awp0WorkflowAssignmentEditService';
import messagingSvc from 'js/messagingService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import localeSvc from 'js/localeService';
import tableDPReqRespHelper from 'js/tableDataProviderRequestResponseHelper';

var exports = {};

let assigneeTypeDispName = '';
let assignerTypeDispName = '';
let reviewersTypeDispName = '';
let acknowledgersTypeDispName = '';
let notifyessTypeDispName = '';

localeSvc.getLocalizedTextFromKey( 'WorkflowDesignerMessages.RESPONSIBLE_PARTY' ).then( result => assigneeTypeDispName = result );
localeSvc.getLocalizedTextFromKey( 'WorkflowCommandPanelsMessages.Assigner' ).then( result => assignerTypeDispName = result );
localeSvc.getLocalizedTextFromKey( 'InboxMessages.addReviewerLabelText' ).then( result => reviewersTypeDispName = result );
localeSvc.getLocalizedTextFromKey( 'WorkflowCommandPanelsMessages.Acknowledgers' ).then( result => acknowledgersTypeDispName = result );
localeSvc.getLocalizedTextFromKey( 'WorkflowCommandPanelsMessages.Notifyees' ).then( result => notifyessTypeDispName = result );

/**
  * Get the profile objects based on selected task template and return the profile object array.
  * @param {Object} data Data view model object
  * @returns {Array} Presnt profile object array
  */
var _populateProfileObjects = function( data ) {
    var profileObjects = [];
    var profileObjectArray = data.reviewProfiles;
    // Check if acknowledge profile is not null then use that else use the review profiles always
    if( data.ackReviewProfiles ) {
        profileObjectArray = data.ackReviewProfiles;
    }
    if( profileObjectArray && profileObjectArray.length > 0 ) {
        profileObjects = awp0TasksUtils.getProfiles( profileObjectArray, data );
    }
    return profileObjects;
};

/**
  * Populate the key role recipient objects that will be shown on UI.
  * @param {Object} data data Declarative view model object
  * @param {Array} keyRoleAssigneeArray Key role recipient array that need to be shown on UI
  * @param {Array} dynamicParticipants Dynamic participants array that will contain participant internal name and display name
  * @returns {Array} Key role recipient objects that will be shown on UI.
  */
var _populateKeyRoleAssignee = function( data, keyRoleAssigneeArray, dynamicParticipants ) {
    var keyRoleAssignee = [];
    _.forEach( keyRoleAssigneeArray, function( keyRole ) {
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
        var keyRoleObject = {
            internalName: internalName,
            displayName: displayName
        };
        keyRoleAssignee.push( keyRoleObject );
    } );
    return keyRoleAssignee;
};

/**
  * Populate the other assignee objects that will be shown on UI.
  * @param {Array} otherAssigneeArray Key role assignee array that need to be shown on UI
  * @param {Array} usersAssignee users assignee array that will contain all user arguments
  * @param {Array} resourcepoolAssignee Resourcepool assignee array that will contain all resourcepool arguments
  * @returns {Array} Other recipient objects that will be shown on UI.
  */
var _populateOtherAssignee = function( otherAssigneeArray, usersAssignee, resourcepoolAssignee ) {
    var otherRecipients = [];
    _.forEach( otherAssigneeArray, function( otherAssignee ) {
        var internalName = otherAssignee;
        var displayName = otherAssignee;
        var actualObjectValue = otherAssignee;
        if( actualObjectValue.indexOf( ':' ) > -1 ) {
            displayName = otherAssignee.substring( otherAssignee.indexOf( ':' ) + 1, otherAssignee.length );
        }
        // This special handling needed for person where person name comes as 'person:Doe\, John' so while
        // rending on UI we need to replace the \, to \| first to get each assignee value because we are splitting
        // with value ',' and then to show the correct person anme replace \| back to \, to internal value and
        // ',' in the display value. Same handling is also being done on server side as well.
        if( actualObjectValue.indexOf( 'person:' ) > -1 && actualObjectValue.indexOf( '\\|' ) > -1 ) {
            internalName = internalName.replace( '\\|', '\\,' );
            displayName = displayName.replace( '\\|', ',' );
        }

        var otherAssigneeObject = {
            internalName: internalName,
            displayName: displayName
        };
        if( actualObjectValue.indexOf( 'resourcepool:' ) > -1 || actualObjectValue.indexOf( 'allmembers:' ) > -1 ) {
            // Special handling for resourcepool case as we need to show person icon instead of key roles icon
            otherAssigneeObject.typeIconURL = 'ResourcePool48';
            if( displayName.indexOf( '::' ) > -1 ) {
                var splitDisplayNames = displayName.split( '::' );
                if( splitDisplayNames && splitDisplayNames.length > 1 && splitDisplayNames[ 1 ] === '' ) {
                    otherAssigneeObject.displayName += '*';
                }
            } else {
                otherAssigneeObject.displayName = '*::' + otherAssigneeObject.displayName;
            }
            resourcepoolAssignee.push( otherAssigneeObject );
        } else {
            // Special handling for user or person case as we need to show person icon instead of key roles icon
            otherAssigneeObject.typeIconURL = 'Person48';
            usersAssignee.push( otherAssigneeObject );
        }
        otherRecipients.push( otherAssigneeObject );
    } );
    return otherRecipients;
};

/**
  * Populate the assignee column data for each specific handler and return the resourcepool argument in one array
  * and other user and key roles in another array.
  * @param {Object} data Data view model object
  * @param {Array} handlerArgumentValues Handler argument values array
  * @param {Array} dynamicParticipants Dynamic participant values that will be used to render on table correctly
  *
  * @returns {Object} Object that will have information for all user, keyroles arguments and resourcepool arguments
  */
var _populateAssigneeData = function( data, handlerArgumentValues, dynamicParticipants ) {
    var keyRoleAssigneeArray = [];
    var otherAssigneeArray = [];
    var keyRoleAssignee = [];
    var otherAssignee = [];
    var usersAssignee = [];
    var resourcepoolAssignee = [];

    var assigneeValue = handlerArgumentValues[ '-assignee' ];
    // Check if assignee argument is not present then return empty object from here.
    if( !assigneeValue ) {
        return {
            keyRoleAssignee: keyRoleAssignee,
            otherAssignee: otherAssignee,
            usersAssignee: usersAssignee,
            resourcepoolAssignee: resourcepoolAssignee
        };
    }

    // This replace is needed if there is any specific argument like person with ',' in between
    // arguemnt value so to handle that replace it with '\|'.
    assigneeValue = assigneeValue.replace( '\\,', '\\|' );
    var splitAssigneeValues = null;
    // Split all assignee values with ',' then parse it to key roles in one array
    // and others teamcenter argument in another array
    if( appCtxSvc.ctx.preferences.EPM_ARG_target_user_group_list_separator && appCtxSvc.ctx.preferences.EPM_ARG_target_user_group_list_separator.length > 0 && appCtxSvc.ctx.preferences.EPM_ARG_target_user_group_list_separator[0].trim() !== '' ) {
        splitAssigneeValues = assigneeValue.split( appCtxSvc.ctx.preferences.EPM_ARG_target_user_group_list_separator[0] );
    }else{
        splitAssigneeValues = assigneeValue.split( ',' );
    }
    if( splitAssigneeValues && splitAssigneeValues.length > 0 ) {
        _.forEach( splitAssigneeValues, function( assigneeValue ) {
            if( assigneeValue.indexOf( '$' ) > -1 ) {
                keyRoleAssigneeArray.push( assigneeValue.trim() );
            } else {
                otherAssigneeArray.push( assigneeValue.trim() );
            }
        } );
        // Filter the assignee further and combine key role and users in one array and resourcepools
        // into another array.
        keyRoleAssignee = _populateKeyRoleAssignee( data, keyRoleAssigneeArray, dynamicParticipants );
        otherAssignee = _populateOtherAssignee( otherAssigneeArray, usersAssignee, resourcepoolAssignee );
        // combine key roles and user argument in one array
        var presetObjects = keyRoleAssignee;
        Array.prototype.push.apply( presetObjects, usersAssignee );
        usersAssignee = presetObjects;
    }

    // Return the object that will contain all value
    return {
        resourcepoolAssignee: resourcepoolAssignee,
        keyRoleAssignee: keyRoleAssignee,
        otherAssignee: otherAssignee,
        usersAssignee: usersAssignee

    };
};

/**
  * Check if selected template is review, route, acknowledge , then return true or false
  * @param {Object} selectedObject Selected template object from graph
  *
  * @returns {boolean} True/false
  */
var _isReviewAckOrRouteTaskTemplateSelected = function( selectedObject ) {
    var isReviewAckRouteTaskSelected = false;
    // Check if input is not null and is one of these types then only return true
    if( selectedObject && selectedObject.modelType && ( selectedObject.modelType.typeHierarchyArray.indexOf( 'EPMReviewTaskTemplate' ) > -1 || selectedObject.modelType.typeHierarchyArray.indexOf( 'EPMAcknowledgeTaskTemplate' ) > -1 ||
             selectedObject.modelType.typeHierarchyArray.indexOf( 'EPMRouteTaskTemplate' ) > -1 ) ) {
        isReviewAckRouteTaskSelected = true;
    }
    return isReviewAckRouteTaskSelected;
};

/**
  * Create the handler empty structure that will be used to populate information for each handler,
  *
  * @returns {Object} Hnadler object structure
  */
var _createEmptyHandlerStructure = function() {
    return {
        assignedBy: 'assigneeAutomated',
        allowReassignOutsideGroupRole: 'no',
        fnd0Assignee: [],
        fnd0Assigner: [],
        awp0Reviewers: [],
        awp0Acknowledgers: [],
        awp0Notifyees: [],
        propToRender: null,
        handlerName: null,
        handlerObject: null,
        isResourePoolRendering: false,
        assigneeObjects: null,
        isReviewersSignoffMust: ''
    };
};

/**
  * Create the view model object based on input handlerInfoObject and columns that need to be rendered on UI.
  * @param {Object} data Data view model object
  * @param {Array} columns table columns present in notification table
  * @param {Object} handlerInfoObject Obejct that will contain all handler related informaiton
  *
  * @returns {Object} Create Handler VMO object
  */
var _addHandlerVMOObject = function( data, columns, handlerInfoObject ) {
    var vmObject = viewModelObjectService.constructViewModelObjectFromModelObject( handlerInfoObject.handlerObject, 'Edit' );
    _.forEach( columns, function( tableColumn ) {
        var dbValue = handlerInfoObject[ tableColumn.name ];
        // This change is needed if property value is empty and we need to show this cell as empty
        // then if we pass empty array then it will show gray skeleton as there is no value and to handle
        // that case we are setting dbValue as null so that it will not show skeleton
        if( !dbValue || dbValue === '' || _.isArray( dbValue ) && _.isEmpty( dbValue ) ) {
            dbValue = null;
        }
        var dispValue = dbValue;
        if( data.i18n[ dbValue ] ) {
            dispValue = data.i18n[ dbValue ];
        }
        var intenalNamesArray = [];
        var displayNamesArray = [];
        if( _.isArray( dbValue ) ) {
            _.forEach( dbValue, function( assignee ) {
                intenalNamesArray.push( assignee.internalName );
                displayNamesArray.push( assignee.displayName );
            } );
            dbValue = intenalNamesArray;
            dispValue = displayNamesArray;
        }

        var vmProp = null;

        // Check if column name is recipients then populate the key role property as well
        // on row obejct that will contain recipients value
        if( tableColumn.name === handlerInfoObject.propToRender ) {
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

    // If this variable is present on input handler object then only set it on VMO that will be
    // use for updating the handlers.
    if( handlerInfoObject.canAdhocHandlerAutoComplete ) {
        vmObject.canAdhocHandlerAutoComplete = handlerInfoObject.canAdhocHandlerAutoComplete;
    }
    vmObject.isResourcePoolAssignee = handlerInfoObject.isResourePoolRendering;
    if( handlerInfoObject.isResourePoolRendering ) {
        // In case of resource pool handler assignment case we are using this workaround so that
        // data provider will show only unique rows and selecting one row will not select other row
        // for same handler if present.
        vmObject.uniqueUid = vmObject.uid;
        vmObject.uid += Math.random();
    }
    vmObject.handlerObject = handlerInfoObject.handlerObject;
    vmObject.handlerName = handlerInfoObject.handlerName;
    vmObject.assigneeObjects = handlerInfoObject[ handlerInfoObject.propToRender ];
    return vmObject;
};

/**
  * Create the profile view model object that need to be shown on UI.
  * @param {Object} data Data view model object
  * @param {Array} argumentRows Arguemnt array where profile object will be added to render on UI.
  * @param {String} propertyName Property name string where values will be dispalyed
  */
var _createProfileTableRows = function( data, argumentRows, propertyName ) {
    // Iterate for all profile objects and populate all the columns
    // and create the object.
    _.forEach( data.profileObjects, function( profile ) {
        var sstProfileObject = _createEmptyHandlerStructure();
        sstProfileObject.isResourePoolRendering = false;

        var profileObject = {
            internalName: profile.props.object_string.dbValue,
            displayName: profile.props.object_string.uiValue
        };

        sstProfileObject.assignedBy = 'assigner';
        sstProfileObject[ propertyName ] = [ profileObject ];
        sstProfileObject.propToRender = propertyName;
        sstProfileObject.handlerObject = profile;

        var vmObject = _addHandlerVMOObject( data, data.columns, sstProfileObject );
        argumentRows.push( vmObject );
    } );
};

/**
  * Check if input object is of type input type. If yes then
  * return true else return false.
  *
  * @param {Obejct} obj Object to be match
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
  * Check if selected template is Select signoff task template then only check if it's parent is acknowledge
  * or review then only we need to change the auto complete value based on check box option. If acknoeledge task
  * template parent is route then we don't need to change it's value.
  * @param {Object} templateObject Template object which need to be check if it's parent is
  *                  EPMReviewTaskTemplate or not.
  *
  * @returns {boolean} True/False Based on validation
  */
var _canAdhocHandlerAutoComplete = function( templateObject ) {
    if( templateObject && isOfType( templateObject, 'EPMSelectSignoffTaskTemplate' ) ) {
        var parentTaskTemplate = Awp0WorkflowDesignerUtils.getParentTaskTemplate( templateObject );
        if( parentTaskTemplate && ( isOfType( parentTaskTemplate, 'EPMReviewTaskTemplate' ) ||
                 isOfType( parentTaskTemplate, 'EPMAcknowledgeTaskTemplate' ) ) ) {
            if( isOfType( parentTaskTemplate, 'EPMAcknowledgeTaskTemplate' ) ) {
                var ackParentTaskTemplate = Awp0WorkflowDesignerUtils.getParentTaskTemplate( parentTaskTemplate );
                if( ackParentTaskTemplate && isOfType( ackParentTaskTemplate, 'EPMRouteTaskTemplate' ) ) {
                    return false;
                }
            }
            return true;
        }
    }
    return false;
};

/**
  * Populate the handler dta for each handler and that will be used while dispalying it on table.
  *
  * @param {Object} data Data view model object
  * @param {Object} selection Selected route task template object from UI
  * @param {String} handlerName Handler name that need to be populated
  * @param {String} propName Property name string where handler assignee will be shown
  * @param {Array} dynamicParticipants All dynamic particiapnts array
  * @param {Array} handlerObjects Handlers objects array that will contain for each handler how many rows will
  *                be rendered on table
  */
var _populateHandlersData = function( data, selection, handlerName, propName, dynamicParticipants, handlerObjects ) {
    var templateObject = clientDataModel.getObject( selection.uid );
    // Get the attached handler objects for specifc input handler name
    var actionHandlerArray = Awp0WorkflowDesignerUtils.getActionHandler( templateObject, handlerName );

    // Iterate for all handler obejcts and add the rows for that handler
    _.forEach( actionHandlerArray, function( actionHandler ) {
        var argumentValues = Awp0WorkflowDesignerUtils.parseHandlerArguments( actionHandler.props.arguments.dbValues );
        var assignemntData = _populateAssigneeData( data, argumentValues, dynamicParticipants );
        if( assignemntData ) {
            if( assignemntData.resourcepoolAssignee && assignemntData.resourcepoolAssignee.length > 0 ) {
                var resourcePoolHandlerObject = _createEmptyHandlerStructure();
                resourcePoolHandlerObject.isResourePoolRendering = true;
                if( handlerName === 'EPM-auto-assign' ) {
                    resourcePoolHandlerObject.allowReassignOutsideGroupRole = null;
                } else {
                    resourcePoolHandlerObject.assignedBy = 'assigneeClaimed';
                }
                if( handlerName === 'EPM-adhoc-signoffs' ) {
                    resourcePoolHandlerObject.allowReassignOutsideGroupRole = 'yes';
                    // Check if we can update this adhoc signoff handler for auto complete
                    resourcePoolHandlerObject.canAdhocHandlerAutoComplete = _canAdhocHandlerAutoComplete( templateObject );
                }
                resourcePoolHandlerObject[ propName ] = assignemntData.resourcepoolAssignee;
                resourcePoolHandlerObject.propToRender = propName;
                resourcePoolHandlerObject.handlerName = handlerName;
                resourcePoolHandlerObject.handlerObject = actionHandler;

                if( handlerName === 'EPM-adhoc-signoffs' || handlerName === 'EPM-fill-in-reviewers' ) {
                    resourcePoolHandlerObject.isReviewersSignoffMust = 'no';

                    // Check if -required argument is present then set 'all reviewers must signoff' to 'Yes'
                    if( argumentValues && argumentValues.hasOwnProperty( '-required' ) ) {
                        resourcePoolHandlerObject.isReviewersSignoffMust = 'yes';
                    }
                }

                handlerObjects.push( resourcePoolHandlerObject );
            }

            if( assignemntData.usersAssignee && assignemntData.usersAssignee.length > 0 ) {
                var userHandlerObject = _createEmptyHandlerStructure();
                userHandlerObject.isResourePoolRendering = false;

                if( handlerName === 'EPM-auto-assign' ) {
                    userHandlerObject.allowReassignOutsideGroupRole = null;
                } else if( handlerName === 'EPM-adhoc-signoffs' ) {
                    userHandlerObject.allowReassignOutsideGroupRole = 'yes';
                    // Check if we can update this adhoc signoff handler for auto complete
                    userHandlerObject.canAdhocHandlerAutoComplete = _canAdhocHandlerAutoComplete( templateObject );
                }

                if( handlerName === 'EPM-adhoc-signoffs' || handlerName === 'EPM-fill-in-reviewers' ) {
                    userHandlerObject.isReviewersSignoffMust = 'no';

                    // Check if -required argument is present then set 'all reviewers must signoff' to 'Yes'
                    if( argumentValues && argumentValues.hasOwnProperty( '-required' ) ) {
                        userHandlerObject.isReviewersSignoffMust = 'yes';
                    }
                }

                userHandlerObject[ propName ] = assignemntData.usersAssignee;
                userHandlerObject.propToRender = propName;
                userHandlerObject.handlerName = handlerName;
                userHandlerObject.handlerObject = actionHandler;

                handlerObjects.push( userHandlerObject );
            }
        }
    } );
};

/**
  * Populate the handlers that need to be shown from route task.
  * @param {Object} templateObject Selected route task template object from UI
  * @param {Object} handlerToShowObject Handler to show object that will contian handler to show for template
  */
var _populateRouteTaskTemplateHandlers = function( templateObject, handlerToShowObject ) {
    if( !templateObject || !handlerToShowObject ) {
        return;
    }
    // For EPMReviewTaskTemplate populate both handlers for review SST task template
    var reviewTaskObject = Awp0WorkflowDesignerUtils.getValidTemplateObject( templateObject, 'EPMReviewTaskTemplate' );
    var templateObj = null;
    if( reviewTaskObject ) {
        templateObj = Awp0WorkflowDesignerUtils.getValidTemplateObject( reviewTaskObject, 'EPMSelectSignoffTaskTemplate' );
        if( templateObj ) {
            handlerToShowObject[ templateObj.uid ] = {
                handlerNames: [ 'EPM-adhoc-signoffs', 'EPM-fill-in-reviewers' ],
                columnNames: [ 'awp0Reviewers', 'awp0Reviewers' ]
            };
        }
    }
    // For EPMAcknowledgeTaskTemplate populate EPM-adhoc-signoffs handler for acknowledge SST task template
    var acknowledgeTaskObject = Awp0WorkflowDesignerUtils.getValidTemplateObject( templateObject, 'EPMAcknowledgeTaskTemplate' );
    if( acknowledgeTaskObject ) {
        templateObj = Awp0WorkflowDesignerUtils.getValidTemplateObject( acknowledgeTaskObject, 'EPMSelectSignoffTaskTemplate' );
        if( templateObj ) {
            handlerToShowObject[ templateObj.uid ] = {
                handlerNames: [ 'EPM-adhoc-signoffs' ],
                columnNames: [ 'awp0Acknowledgers' ]
            };
        }
    }

    // For EPMNotifyTaskTemplate populate EPM-adhoc-signoffs handler for notify task template
    templateObj = Awp0WorkflowDesignerUtils.getValidTemplateObject( templateObject, 'EPMNotifyTaskTemplate' );
    if( templateObj ) {
        handlerToShowObject[ templateObj.uid ] = {
            handlerNames: [ 'EPM-adhoc-signoffs' ],
            columnNames: [ 'awp0Notifyees' ]
        };
    }
};

/**
  * Populate the handlers that needs to be populated based on selection.
  *
  * @param {Object} selection Selected task template object from UI
  * @returns {Object} Handlers that need to be populated for specific template where it will be shown
  */
var _populateHandlerToShowBasedSelection = function( selection ) {
    var handlerToShowObject = {};
    if( !selection ) {
        return handlerToShowObject;
    }

    var templateObject = clientDataModel.getObject( selection.uid );
    // When selected template is EPMReviewTaskTemplate then we need to populate both handlers and need to be rendered
    // in awp0Reviewers column
    if( isOfType( templateObject, 'EPMReviewTaskTemplate' ) ) {
        var reviewSSTObject = Awp0WorkflowDesignerUtils.getValidTemplateObject( templateObject, 'EPMSelectSignoffTaskTemplate' );
        if( reviewSSTObject ) {
            handlerToShowObject[ reviewSSTObject.uid ] = {
                handlerNames: [ 'EPM-adhoc-signoffs', 'EPM-fill-in-reviewers' ],
                columnNames: [ 'awp0Reviewers', 'awp0Reviewers' ]
            };
        }
    } else if( isOfType( templateObject, 'EPMAcknowledgeTaskTemplate' ) ) {
        // When selected template is EPMAcknowledgeTaskTemplate then we need to populate EPM-adhoc-signoffs handler and need to be rendered
        // in awp0Acknowledgers column
        var acknowledgeSSTObject = Awp0WorkflowDesignerUtils.getValidTemplateObject( templateObject, 'EPMSelectSignoffTaskTemplate' );
        if( acknowledgeSSTObject ) {
            handlerToShowObject[ acknowledgeSSTObject.uid ] = {
                handlerNames: [ 'EPM-adhoc-signoffs', 'EPM-fill-in-reviewers' ],
                columnNames: [ 'awp0Acknowledgers', 'awp0Acknowledgers' ]
            };
        }
    } else if( isOfType( templateObject, 'EPMRouteTaskTemplate' ) ) {
        // When selected template is EPMRouteTaskTemplate then we need to populate handlers for route individual task and add to invidual columns
        _populateRouteTaskTemplateHandlers( templateObject, handlerToShowObject );
    }
    if( _isReviewAckOrRouteTaskTemplateSelected( templateObject ) ) {
        handlerToShowObject[ templateObject.uid ] = {
            handlerNames: [ 'EPM-auto-assign' ],
            columnNames: [ 'fnd0Assigner' ]
        };
    } else {
        handlerToShowObject[ templateObject.uid ] = {
            handlerNames: [ 'EPM-auto-assign' ],
            columnNames: [ 'fnd0Assignee' ]
        };
    }
    return handlerToShowObject;
};

/**
  * Populate the auto complete option value on the assignment tab based on last adhoc signoff handler.
  * @param {Object} data Data view model object
  * @param {Object} templateObject template object for handler need to be populated
  *
  * @returns {boolean} True/False
  */
var _populateAdhocHandlerAutoCompleteOption = function( data, templateObject ) {
    data.adhocSignoffHandlers = null;
    // Default value for this variable is true and if handlers present and then based on
    // argument present on handler we will set the correct value and if this present then
    // this variable value should be false else it will be true always. This is the negation
    // case here.
    var autoCompleteValue = true;
    // Check if template is null then no need to process further and return from here
    if( !templateObject ) {
        return autoCompleteValue;
    }

    var validTemplateObject = null;

    // Check if selected obejct is review or acknowledge then get the SST task from it and if its route task then get
    // review -> SST task and use that to get all handlers.
    if( isOfType( templateObject, 'EPMReviewTaskTemplate' ) || isOfType( templateObject, 'EPMAcknowledgeTaskTemplate' ) ) {
        validTemplateObject = Awp0WorkflowDesignerUtils.getValidTemplateObject( templateObject, 'EPMSelectSignoffTaskTemplate' );
    } else if( isOfType( templateObject, 'EPMRouteTaskTemplate' ) ) {
        var reviewTaskObject = Awp0WorkflowDesignerUtils.getValidTemplateObject( templateObject, 'EPMReviewTaskTemplate' );
        if( reviewTaskObject ) {
            validTemplateObject = Awp0WorkflowDesignerUtils.getValidTemplateObject( reviewTaskObject, 'EPMSelectSignoffTaskTemplate' );
        }
    }

    if( validTemplateObject ) {
        // Get the attached handler objects for specifc input handler name
        var actionHandlerArray = Awp0WorkflowDesignerUtils.getActionHandler( validTemplateObject, 'EPM-adhoc-signoffs' );
        if( actionHandlerArray && actionHandlerArray.length > 0 ) {
            // Get the last adhoc signoff handler as that handler auto_complete value will be used while
            // executing the task finally.
            data.adhocSignoffHandlers = actionHandlerArray;
            var validHandler = actionHandlerArray[ actionHandlerArray.length - 1 ];
            if( validHandler ) {
                var argumentValues = Awp0WorkflowDesignerUtils.parseHandlerArguments( validHandler.props.arguments.dbValues );
                if( argumentValues && argumentValues.hasOwnProperty( '-auto_complete' ) ) {
                    autoCompleteValue = false;
                }
                // Set the current value for auto complete option.
                data.autoCompleteSignoffOption.dbValue = autoCompleteValue;
                data.autoCompleteSignoffOption.isEditable = data.isAssignmentTabEditMode;
                data.autoCompleteSignoffOption.isEnabled = data.isAssignmentTabEditMode;
                // This is used to show interactive paused ro reviewers option on assignment tab.
                data.isAutoCompleteOptionPresent = true;
            }
        }
    }
    return autoCompleteValue;
};

/**
  * Update the quorum text element margin from top
  */
var _updateQuorumElementSize = function() {
    var percentQuorumElement = document.getElementById( 'sstPercentQuorumValue' );
    var numericQuorumElement = document.getElementById( 'sstNumericQuorumValue' );

    if( percentQuorumElement ) {
        percentQuorumElement.style.marginTop = '0px';
    }

    if( numericQuorumElement ) {
        numericQuorumElement.style.marginTop = '0px';
    }
};

/**
  * Populate Participation section of the Assignmebt tab
  * @param {Object} data Data view model object
  * @param {Object} templateObject template object for handler need to be populated
  * @param {Boolean} isEditable template is in edit mode or not
  * @param {Object} vmoObject View model object
  */
var _populateMinimumParticipantData = function( data, templateObject, isEditable, vmoObject ) {
    if( !data.numericQuorumValue.valueUpdated && !data.percentQuorumValue.valueUpdated && data.taskTemplateQuorumValue ) {
        //Default value if new template is created and assignment tab is open
        data.percentQuorumValue.dbValue = '100';
        data.numericQuorumValue.dbValue = '';
        var quorumValue = _.parseInt( data.taskTemplateQuorumValue );

        // IF quorum value is negative, it signifies approval quorum in percentage
        // Else, it signifies approval quorum in numeric value.
        if( quorumValue < 0 ) {
            data.quorumOptions.dbValue = true;
            data.percentQuorumValue.dbValue = Math.abs( quorumValue );
        } else {
            data.quorumOptions.dbValue = false;

            // Find the total reviewers count of all EPMSignoffProfiles attached to the template
            var numberOfReviewersCount = 0;

            _.forEach( data.profileObjects, function( object ) {
                if( object && object.modelType && object.modelType.typeHierarchyArray.indexOf( 'EPMSignoffProfile' ) > -1 ) {
                    numberOfReviewersCount += object.props.number_of_signoffs.dbValue;
                }
            } );

            data.numberOfReviewersCount = numberOfReviewersCount;

            // IF numeric quorum value exceeds reviewers count, throw information message and set the quorum value to reviewers count.
            // Else, set the quroum value to the provided value.
            if( numberOfReviewersCount < quorumValue ) {
                var signoffQuorum = '-100';
                data.adjustedQuorumValue = '100%';

                // IF reviewers count after removing the profile is greater than 0, throw information message and set the quorum value to reviewers count.
                // Else, if reviewers count after removing the profile is 0, throw information message and set the quorum to percentage quorum and value as 100.
                if( numberOfReviewersCount > 0 ) {
                    data.numericQuorumValue.dbValue = Math.abs( numberOfReviewersCount );
                    var signoffQuorum = data.numericQuorumValue.dbValue.toString();
                    data.adjustedQuorumValue = signoffQuorum;
                } else {
                    data.quorumOptions.dbValue = true;
                    data.percentQuorumValue.dbValue = Math.abs( signoffQuorum );
                }

                messagingSvc.reportNotyMessage( data, data._internal.messages, 'invalidSignoffQuorumDeletion' );

                var vecNameVal = [ {
                    name: 'review_task_quorum',
                    values: [ signoffQuorum ]
                } ];

                // Get SST task for quorum value need to be set
                var sstTaskObject = Awp0WorkflowDesignerUtils.getValidTemplateObject( templateObject, 'EPMSelectSignoffTaskTemplate' );
                // Check if SST task object is not null and valid then set the quorum values correctly
                if( sstTaskObject && sstTaskObject.uid ) {
                    var inputData = [ {
                        object: sstTaskObject,
                        timestamp: '',
                        vecNameVal: vecNameVal
                    } ];
                    soaSvc.post( 'Core-2010-09-DataManagement', 'setProperties', {
                        info: inputData
                    } ).then( function(  ) {
                        data.taskTemplateQuorumValue = signoffQuorum;
                        data.numericQuorumValue.valueUpdated = false;
                        data.percentQuorumValue.valueUpdated = false;
                    } );
                }
            } else {
                data.numericQuorumValue.dbValue = Math.abs( quorumValue );
            }
        }
    }

    // Get wait_for_all_reviewers property value and display name for label
    var inputSSTObj = Awp0WorkflowDesignerUtils.getValidTemplateObject( templateObject, 'EPMSelectSignoffTaskTemplate' );
    if( inputSSTObj && inputSSTObj.props && inputSSTObj.props.wait_for_all_reviewers ) {
        var waitForReviewersValue = inputSSTObj.props.wait_for_all_reviewers.dbValues[ 0 ];
        data.waitForReviewers.dbValue = waitForReviewersValue === '1';
        data.sstTaskTemplateObject = inputSSTObj;
        data.waitForReviewers.propertyDisplayName = inputSSTObj.props.wait_for_all_reviewers.propertyDescriptor.displayName;
    }

    // Add the quorum options prop widget on widget so that that can be used to get the correct
    // values when user wants to save the values for quorum.
    vmoObject.props.quorumOptions = data.quorumOptions;

    data.percentQuorumValue.isEditable = true;
    vmoObject.props.percentQuorumValue = data.percentQuorumValue;

    vmoObject.props.numericQuorumValue = data.numericQuorumValue;
    data.numericQuorumValue.isEditable = true;
    data.numericQuorumValue.isEnabled = isEditable;

    vmoObject.props.waitForReviewers = data.waitForReviewers;
    data.waitForReviewers.isEditable = true;
    vmoObject.props.waitForReviewers.valueUpdated = false;
};


/**
 * Update the input data provider based on selection for other handlers
 *
 * @param {Object} incontextData Data view model object
 * @param {Object} selection template object for handler need to be populated
 * @param {Object} dataProvider Data provider object that needs to be updated
 * @param {Array} handlerNames Handler names that need to be populated in action table
 * @param {Array} dynamicParticipants Dynamic participants array that will contain internal name and display name
 * @param {Object} assignmentHandlerContext Assignment handler context object
 * @param {Object} subPanelContext Sub panel context object that will hold all required info
 * @param {Object} fields fields from viewModel
 * @returns {Object} Table result object
 */
export let populateAssignmentTableData = function( incontextData, selection, dataProvider, handlerNames, dynamicParticipants, assignmentHandlerContext, subPanelContext, fields ) {
    let data = { ...incontextData };
    let fieldProps = [ 'numericQuorumValue', 'percentQuorumValue', 'quorumOptions' ];
    var argumentRows = [];
    data.isReviewACKRouteTaskSelected = false;
    data.isAutoCompleteOptionPresent = false;
    var templateObject = clientDataModel.getObject( selection.uid );
    // Get the tempalte is in edit mode or not and based on that populate the panel.
    var isPanelEditable = Awp0WorkflowDesignerUtils.isTemplateEditMode( subPanelContext.selected, subPanelContext.workflowDgmEditCtx );
    data.isAssignmentTabEditMode = isPanelEditable;
    var vmoObject = viewModelObjectService.createViewModelObject( templateObject.uid );

    // Check the selected task is Review, Acknowledge, Route or SST task then only set this variable on data
    if( _isReviewAckOrRouteTaskTemplateSelected( templateObject ) ) {
        data.isReviewACKRouteTaskSelected = true;
        _updateQuorumElementSize();
    }
    // Fix for defect # LCS-359176 where table row is added first and then columns are getting added
    // so to avoid that case and VMO has correct properties, doing this calculation here.
    var tableColumns = data.singleUserTaskTemplateColumns;
    if( isOfType( selection, 'EPMReviewTaskTemplate' ) ) {
        tableColumns = data.reviewTaskTemplateColumns;
    } else if( isOfType( selection, 'EPMRouteTaskTemplate' ) ) {
        tableColumns = data.routeTaskTemplateColumns;
    } else if( isOfType( selection, 'EPMAcknowledgeTaskTemplate' ) ) {
        tableColumns = data.acknowledgeTaskTemplateColumns;
    }
    data.columns = tableColumns;

    data.profileObjects = [];
    // Check if selected task is valid type then only populate the profiles info and add the profile objects
    // into the assignment table
    if( data.isReviewACKRouteTaskSelected ) {
        var profileObjects = _populateProfileObjects( data );
        if( profileObjects && profileObjects.length > 0 ) {
            data.profileObjects = profileObjects;
            var propName = 'awp0Reviewers';
            // If selected template is acknowledge then we need to show the profile values in acknowledgers column
            // and in all other cases we need to show in reviewers column
            if( isOfType( templateObject, 'EPMAcknowledgeTaskTemplate' ) ) {
                propName = 'awp0Acknowledgers';
            }
            _createProfileTableRows( data, argumentRows, propName );
        }

        // Populate Participation section of the tab
        _populateMinimumParticipantData( data, templateObject, isPanelEditable, vmoObject );
    }

    var handlerObjects = [];
    // Populate the handlers that need to be shown based on current selected template
    var handlersToShow = _populateHandlerToShowBasedSelection( templateObject );

    // Populate the handlers data for each handler based on each object where handler is added
    _.forOwn( handlersToShow, function( object, templateObjUid ) {
        var columnNames = object.columnNames;
        var handlersArray = object.handlerNames;

        for( var idx = 0; idx < handlersArray.length; idx++ ) {
            var templateObject = clientDataModel.getObject( templateObjUid );
            _populateHandlersData( data, templateObject, handlersArray[ idx ], columnNames[ idx ], dynamicParticipants, handlerObjects );
        }
    } );

    // Render all handlers in the table and create the view model objects and render in table
    if( handlerObjects && handlerObjects.length > 0 ) {
        _.forEach( handlerObjects, function( handlerObject ) {
            var vmoObject = _addHandlerVMOObject( data, data.columns, handlerObject );
            if( vmoObject ) {
                argumentRows.push( vmoObject );
            }
        } );
    }

    // Populate the auto complete for adhoc signoff handler option
    var autoCompleteValue = _populateAdhocHandlerAutoCompleteOption( data, templateObject );

    // Create the table result data and return to dispaly on UI.
    var loadResult = tableDPReqRespHelper.createTableLoadResult( argumentRows.length );
    loadResult.searchResults = argumentRows;
    loadResult.searchIndex = 0;
    loadResult.totalFound = argumentRows.length;
    data.vmo = vmoObject;
    if( isPanelEditable ) {
        exports.addEditHandler( data );
    }
    dataProvider.update( argumentRows, argumentRows.length );

    const localContext = { ...assignmentHandlerContext };
    localContext.loadedVMOObjects = argumentRows;
    localContext.isTemplateEditable = data.isTemplateEditable;
    localContext.isAutoCompleteOptionPresent = data.isAutoCompleteOptionPresent;
    localContext.profileObjects = profileObjects;
    localContext.selectedTemplateObject = data.selectedTemplateObject;
    localContext.rootTaskTemplateObject = data.rootTaskTemplateObject;
    localContext.autoCompleteOption = autoCompleteValue;
    loadResult.assignmentHandlerContext = localContext;

    if( fields ) {
        _.forEach( fieldProps, function( fieldProp ){
            if( data[fieldProp].dbValue || fieldProp === 'quorumOptions' ) {
                fields[fieldProp].update( data[fieldProp].dbValue, {}, {markModified: true} );
            } else {
                fields[fieldProp].update( data[fieldProp].dbValue, {}, {markModified: false} );
            }
        });
    }

    return {
        searchIndex:0,
        isReviewACKRouteTaskSelected:data.isReviewACKRouteTaskSelected,
        isAutoCompleteOptionPresent:data.isAutoCompleteOptionPresent,
        autoCompleteSignoffOption:data.autoCompleteSignoffOption,
        isAssignmentTabEditMode:data.isPanelEditable,
        profileObjects:data.profileObjects,
        numberOfReviewersCount:data.numberOfReviewersCount,
        adjustedQuorumValue:data.adjustedQuorumValue,
        waitForReviewers:data.waitForReviewers,
        vmo:data.vmo,
        columns:data.columns,
        tableResult:loadResult,
        assignmentHandlerContext:localContext,
        adhocSignoffHandlers : data.adhocSignoffHandlers
    };
};


/**
  * Populate the assignment table columns based on current selection type.
  *
  * @param {Object} data Data view model object
  * @param {Object} dataProvider Data provider object that needs to be updated
  * @param {Object} selection template object for handler need to be populated
  *
  * @returns {Promise} Promise object that will contain assignment table columns
  */
export let loadAssignmentTableColumns = function( data, dataProvider, selection ) {
    var deferred = AwPromiseService.instance.defer();
    var columnInfos = data.singleUserTaskTemplateColumns;
    // Check if select task is review then show the review columns and in case of acknowledge show acknowledge column
    // and in route show route related columns
    if( isOfType( selection, 'EPMReviewTaskTemplate' ) ) {
        columnInfos = data.reviewTaskTemplateColumns;
    } else if( isOfType( selection, 'EPMRouteTaskTemplate' ) ) {
        columnInfos = data.routeTaskTemplateColumns;
    } else if( isOfType( selection, 'EPMAcknowledgeTaskTemplate' ) ) {
        columnInfos = data.acknowledgeTaskTemplateColumns;
    }

    var visibleColumnInfos = columnInfos;
    data.columns = visibleColumnInfos;
    dataProvider.columnConfig = {
        columns: visibleColumnInfos
    };

    deferred.resolve( {
        columnInfos: visibleColumnInfos
    } );
    return deferred.promise;
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
        return;
    }
    // Get the template object obejct from client data model and use it to get the proper handlers
    var templateObject = clientDataModel.getObject( selection.uid );
    if( !templateObject ) {
        return;
    }
    var modelObject = Awp0WorkflowDesignerUtils.getValidTemplateObject( templateObject, 'EPMSelectSignoffTaskTemplate' );
    if( modelObject ) {
        selectedObjects.push( modelObject );
    }
    if( isOfType( templateObject, 'EPMRouteTaskTemplate' ) ) {
        var acknowledgeTaskObject = Awp0WorkflowDesignerUtils.getValidTemplateObject( templateObject, 'EPMAcknowledgeTaskTemplate' );
        if( acknowledgeTaskObject ) {
            modelObject = Awp0WorkflowDesignerUtils.getValidTemplateObject( acknowledgeTaskObject, 'EPMSelectSignoffTaskTemplate' );
            if( modelObject ) {
                selectedObjects.push( modelObject );
            }
        }
        var notifyTemplateObject = Awp0WorkflowDesignerUtils.getValidTemplateObject( templateObject, 'EPMNotifyTaskTemplate' );
        if( notifyTemplateObject ) {
            selectedObjects.push( notifyTemplateObject );
        }
    }
    selectedObjects.push( templateObject );
    return selectedObjects;
};


/**
 * Check when user is selecting any row in assignment table and Add or show panel is open then close the panel
 * @param {Object} ctx Context object to check if panel is already open or not
 * @param {Array} selectedRows Selected rows from UI notification table
 * @param {Object} assignmentHandlerContext Handler context object that stores context info.
 *
 * @returns {Object} Updated notification handler context object
 */
export let assignmentHandlerRowSelection = function( ctx, selectedRows, assignmentHandlerContext ) {
    if( ctx.activeToolsAndInfoCommand && (
        ctx.activeToolsAndInfoCommand.commandId === 'Awp0WorkflowAddAssignmentHandler'
        || ctx.activeToolsAndInfoCommand.commandId === 'Awp0TemplateShowProfileInfo'
        || ctx.activeToolsAndInfoCommand.commandId === 'Awp0TemplateEditProfileInfo'
        || ctx.activeToolsAndInfoCommand.commandId === 'Awp0WorkflowShowAssignmentHandler'
        || ctx.activeToolsAndInfoCommand.commandId === 'Awp0WorkflowEditAssignmentHandler' ) ) {
        eventBus.publish( 'closePanel' );
    }
    const localContext = { ...assignmentHandlerContext };
    localContext.selectedObjects = selectedRows;
    return localContext;
};


/**
  * Check if whole action handler need to be deleted or some arguemnt need to be deleted and based on that
  * fire the specific event so that specific action can be done.
  * @param {Object} selectedObject Selected handler row from assignemnt table need to be deleted.
  */
export let removeAssignmentHandlerAction = function(  selectedObject ) {
    if( !selectedObject || !selectedObject.props.keyRole || !selectedObject.props.keyRole.dbValue ) {
        return;
    }
    var currentAssigneeValue = selectedObject.props.keyRole.dbValue;
    var allAssigee = [];
    var assigeeArray = null;
    // Get all argument values for that handler and then split the assignee based on '-assignee' arguemtn value
    var argumentValues = Awp0WorkflowDesignerUtils.parseHandlerArguments( selectedObject.props.arguments.dbValues );
    if( argumentValues && argumentValues[ '-assignee' ] ) {
        var assigneeValue = argumentValues[ '-assignee' ];
        // This replace is needed if there is any specific argument like person with ',' in between
        // arguemnt value so to handle that replace it with '\|'.
        assigneeValue = assigneeValue.replace( '\\,', '\\|' );
        if( appCtxSvc.ctx.preferences.EPM_ARG_target_user_group_list_separator && appCtxSvc.ctx.preferences.EPM_ARG_target_user_group_list_separator.length > 0 && appCtxSvc.ctx.preferences.EPM_ARG_target_user_group_list_separator[0].trim() !== '' ) {
            assigeeArray = assigneeValue.split( appCtxSvc.ctx.preferences.EPM_ARG_target_user_group_list_separator[0] );
        }else{
            assigeeArray = assigneeValue.split( ',' );
        }

        _.forEach( assigeeArray, function( assignee ) {
            // Replace it back to original value
            var finalValue = assignee.replace( '\\|', '\\,' );
            allAssigee.push( finalValue );
        } );
    }
    var selectedHandlerObject = selectedObject;
    if( selectedHandlerObject && selectedHandlerObject.uniqueUid ) {
        selectedHandlerObject = _.clone( selectedHandlerObject );
        selectedHandlerObject.uid = selectedHandlerObject.uniqueUid;
    }

    // Find the difference form all assignee and selected row assignee value and if some assignee need
    // to be still there then it will fire update handler else it will fire delete handler.
    var finalAssigneeArgumentValues = _.difference( allAssigee, currentAssigneeValue );
    if( finalAssigneeArgumentValues && finalAssigneeArgumentValues.length > 0 ) {
        eventBus.publish( 'workflowDesigner.updateHandler', {
            handlerObject: selectedHandlerObject,
            validAssignee: finalAssigneeArgumentValues
        } );
    } else {
        eventBus.publish( 'workflowDesigner.deleteHandler', {
            handlerObject: selectedHandlerObject
        } );
    }
};

/**
  * Reset the edit mode for auto complete option.
  * @param {boolean} isAutoCompleteOptionPresent Is auto complete option present or not.
  * @param {Object} autoCompleteSignoffOptionProp auto complete signoff option property object
  * @param {Object} rootTaskTemplateObject Selected root task template object
  *
  * @return {Object} Update auto complete property object along with tab is in edit mode or not value.
  *
  */
export let resetAssignementTableEditMode = function( isAutoCompleteOptionPresent, autoCompleteSignoffOptionProp, rootTaskTemplateObject ) {
    const autoCompleteSignoffOption = { ...autoCompleteSignoffOptionProp };
    var isPanelEditable = false;
    // Check if auto complete option present then only need to reset
    if( isAutoCompleteOptionPresent ) {
        // Get the tempalte is in edit mode or not and based on that populate the panel.
        isPanelEditable = Awp0WorkflowDesignerUtils.isTemplateEditMode( rootTaskTemplateObject, appCtxSvc.ctx );

        // Set the edit mode for auto complete option.
        autoCompleteSignoffOption.isEditable = isPanelEditable;
        autoCompleteSignoffOption.isEnabled = isPanelEditable;
    }
    return {
        isAssignmentTabEditMode: isPanelEditable,
        autoCompleteSignoffOption: autoCompleteSignoffOption
    };
};

/**
  * Check for all present objects in assignemnt table and get all signoff handlers and based on selected
  * auto complete option from UI update all handlers accordingly.
  *
  * @param {Object} data Data view model object
  *
  * @returns {Object} Updated assignment handler context object with auto complete option value
  */
export let autoCompleteSignoffOptions = function( data ) {
    // Check if input data is invalid or no signoff handler present then no need to process further and return from here
    const assignmentHandlerContextTemp = { ...data.assignmentHandlerContext };
    if( !data.adhocSignoffHandlers ) {
        return assignmentHandlerContextTemp;
    }

    var loadedObjects = data.adhocSignoffHandlers;
    var adhocSignOffHandlerUids = [];
    var input = [];
    _.forEach( loadedObjects, function( loadedObject ) {
        if( loadedObject.type === 'EPMHandler' && adhocSignOffHandlerUids.indexOf( loadedObject.uid ) <= -1 ) {
            adhocSignOffHandlerUids.push( loadedObject.uid );
        }
    } );

    var autoCompleteOption = data.autoCompleteSignoffOption.dbValue;
    assignmentHandlerContextTemp.autoCompleteOption = autoCompleteOption;

    // Iterate for all signoff handlers and based on auto complete option , update the
    // handlers additional data and create input data to update the handler.
    _.forEach( adhocSignOffHandlerUids, function( signoffHandlerUid ) {
        var additionalDataMap = {};
        var handlerObject = clientDataModel.getObject( signoffHandlerUid );
        Awp0WorkflowDesignerUtils.updateAdditionalDataWithOtherArguments( handlerObject, additionalDataMap );
        if( autoCompleteOption && additionalDataMap.hasOwnProperty( '-auto_complete' ) ) {
            delete additionalDataMap[ '-auto_complete' ];
        } else {
            additionalDataMap[ '-auto_complete' ] = [];
        }

        var updateObject = {
            clientID: 'updateHandler -' + signoffHandlerUid,
            handlerToUpdate: signoffHandlerUid,
            additionalData: additionalDataMap
        };
        input.push( updateObject );
    } );

    // Check if input is not null and not empty then only pass the event to call the SOA.
    if( input && input.length > 0 ) {
        eventBus.publish( 'workflowDesigner.updateSignoffHandlers', {
            updateHandlersInput: input
        } );
    }
    return assignmentHandlerContextTemp;
};

/**
  * Creates an edit handler for the view model object.
  * @param {Object} data Data view model object
  *
  */
export let addEditHandler = function( data ) {
    //Save edit
    var saveEditFunc = function() {
        // function that returns a promise.
        var deferred = AwPromiseService.instance.defer();
        exports.saveParticipationDetails( data, true );
        deferred.resolve( {} );
        return deferred.promise;
    };

    //Cancel edit
    var cancelEditFunc = function() {
        // function that returns a promise.
        var deferred = AwPromiseService.instance.defer();
        if( data && data.vmo ) {
            data.vmo.clearEditiableStates( true );
        }
        deferred.resolve( {} );
        return deferred.promise;
    };

    // Pass true as last argument to enable auto save
    editService.createEditHandlerContext( data, null, saveEditFunc, cancelEditFunc, 'TEMPLATE_PARTICIPATION_EDIT', null, true );
};

/**
  * Update the template properties
  * @param {Object} data Data view model object
  * @param {Boolean} refreshPanel True or false based on panel need to be refresh or not
  */
export let saveParticipationDetails = function( data, refreshPanel ) {
    var waitForReviewer = '0';

    var numberOfReviewersCount = 0;

    _.forEach( data.profileObjects, function( object ) {
        if( object && object.modelType && object.modelType.typeHierarchyArray.indexOf( 'EPMSignoffProfile' ) > -1 ) {
            numberOfReviewersCount += object.props.number_of_signoffs.dbValue;
        }
    } );

    var quorumValue = _.parseInt( data.taskTemplateQuorumValue );

    // IF quorum value exceeds reviewers count, throw error below error message
    // The quorum \"{0}\" cannot exceed the total number of reviewers \"{1}\".
    // Else If negative integer is provied as numeric value, throw invalid value error message
    // and change the quorum to previously saved valid value.
    data.numberOfReviewersCount = numberOfReviewersCount;
    var numericQuorumValue = _.parseInt( data.vmo.props.numericQuorumValue.dbValue );
    if( !data.vmo.props.quorumOptions.dbValue && numberOfReviewersCount < numericQuorumValue && numericQuorumValue > 0 ) {
        messagingSvc.reportNotyMessage( data, data._internal.messages, 'invalidNumericQuorumMessage' );

        // IF quorum value is greater than 0, set the numeric quorum value to previously saved valid numeric quorum value
        // Else change the quorum option to Percent which is previously saved valid value and clear the numeric text box.
        if ( quorumValue >= 0 ) {
            data.numericQuorumValue.dbValue = Math.abs( quorumValue );
        } else {
            data.numericQuorumValue.dbValue = '';
            data.quorumOptions.dbValue = true;
        }

        // Quorum is set to pervious valid value hence setting value updated to false
        data.vmo.props.percentQuorumValue.valueUpdated = false;
        data.vmo.props.numericQuorumValue.valueUpdated = false;

        return;
    } else if( !data.vmo.props.quorumOptions.dbValue && ( numericQuorumValue <= 0 || numericQuorumValue === '-' || _.isNaN( numericQuorumValue ) ) ) {
        messagingSvc.reportNotyMessage( data, data._internal.messages, 'invalidQuorumMessage' );

        // IF quorum value is greater than 0, set the numeric quorum value to previously saved valid numeric quorum value
        // Else change the quorum option to Percent which is previously saved valid value and clear the numeric text box.
        if ( quorumValue >= 0 ) {
            data.numericQuorumValue.dbValue = Math.abs( quorumValue );
        } else {
            data.numericQuorumValue.dbValue = '';
            data.quorumOptions.dbValue = true;
        }

        // Quorum is set to pervious valid value hence setting value updated to false
        data.vmo.props.percentQuorumValue.valueUpdated = false;
        data.vmo.props.numericQuorumValue.valueUpdated = false;

        return;
    }

    // IF Percentage Quorum value exceeds 100%, throw error below error message
    // The quorum value is not valid.
    var percentQuorumValue = data.vmo.props.percentQuorumValue.dbValue;
    if( data.vmo.props.quorumOptions.dbValue && ( percentQuorumValue <= 0 || percentQuorumValue > 100 ) ) {
        messagingSvc.reportNotyMessage( data, data._internal.messages, 'invalidQuorumMessage' );

        // IF quorum value is less than 0, set the percent quorum value to previously saved valid percent quorum value
        // Else change the quorum option to Numeric which is previously saved valid value and clear the percent text box.
        data.percentQuorumValue.dbValue = Math.abs( quorumValue );
        if ( quorumValue <= 0 ) {
            data.percentQuorumValue.dbValue = Math.abs( quorumValue );
        } else {
            data.percentQuorumValue.dbValue = '';
            data.quorumOptions.dbValue = false;
        }

        // Quorum is set to pervious valid value hence setting value updated to false
        data.vmo.props.percentQuorumValue.valueUpdated = false;
        data.vmo.props.numericQuorumValue.valueUpdated = false;

        return;
    }


    if( data.vmo && data.vmo.props.waitForReviewers && data.vmo.props.waitForReviewers.dbValue ) {
        waitForReviewer = '1';
    }

    var signoffQuorum = '-100';

    if( data.vmo.props.quorumOptions.dbValue ) {
        if( percentQuorumValue ) {
            signoffQuorum = '-' + percentQuorumValue.toString();
        }
    } else {
        // Check if numericQuorumValue is not null and not NaN ( not invalid value ) then only
        // call the SOA to update the value.
        if( numericQuorumValue && !_.isNaN( numericQuorumValue ) ) {
            signoffQuorum = numericQuorumValue.toString();
        }
    }
    var vecNameVal = [ {
        name: 'wait_for_all_reviewers',
        values: [ waitForReviewer ]
    },  {
        name: 'review_task_quorum',
        values: [ signoffQuorum ]
    } ];

    if( data.sstTaskTemplateObject ) {
        var inputData = [ {
            object: data.sstTaskTemplateObject,
            timestamp: '',
            vecNameVal: vecNameVal
        } ];
        soaSvc.post( 'Core-2010-09-DataManagement', 'setProperties', {
            info: inputData
        } ).then( function(  ) {
            if ( refreshPanel && data && data.vmo ) {
                data.vmo.props.percentQuorumValue.valueUpdated = false;

                data.vmo.props.numericQuorumValue.valueUpdated = false;

                data.vmo.props.waitForReviewers.valueUpdated = false;
                data.taskTemplateQuorumValue = signoffQuorum;

                if( signoffQuorum === '-100' ) {
                    data.quorumOptions.dbValue = true;
                    data.percentQuorumValue.dbValue = '100';
                }
            }
        } );
    }
};

/**
  * Return the proeprty value for input property name if value is not null and it will have some
  * valid value then only return the property value else return null.
  * @param {Object} handlerContextObject Handler context object that will contain handler information
  * @param {String} propName Property name whose value need to be check.
  *
  * @returns {Object} Property value object
  */
var _getPropValue = function( handlerContextObject, propName ) {
    var propValue = null;
    if( handlerContextObject && handlerContextObject.props[ propName ] && handlerContextObject.props[ propName ].dbValue &&
         handlerContextObject.props[ propName ].dbValue.length > 0 ) {
        propValue = handlerContextObject.props[ propName ].dbValue;
    }
    return propValue;
};

/**
 * Get the correct assignment type from input selected handler object.
 *
 * @param {Object} handlerObject Handler object to find the correct assignment type
 * @returns {Object} Assignment type name along with it's diplay name to be shown on panel.
 */
export let getAssignmentTypeInfoBasedOnSelection = function( handlerObject ) {
    if( !handlerObject ) {
        return null;
    }
    var assignmentType = null;
    var assignmentTypeDispName = null;

    if( _getPropValue( handlerObject, 'fnd0Assignee' ) ) {
        assignmentType = 'assignee';
        assignmentTypeDispName = assigneeTypeDispName;
    } else if ( _getPropValue( handlerObject, 'fnd0Assigner' ) ) {
        assignmentType = 'assigner';
        assignmentTypeDispName = assignerTypeDispName;
    } else if ( _getPropValue( handlerObject, 'awp0Reviewers' ) ) {
        assignmentType = 'reviewers';
        assignmentTypeDispName = reviewersTypeDispName;
    } else if ( _getPropValue( handlerObject, 'awp0Acknowledgers' ) ) {
        assignmentType = 'acknowledgers';
        assignmentTypeDispName = acknowledgersTypeDispName;
    } else if ( _getPropValue( handlerObject, 'awp0Notifyees' ) ) {
        assignmentType = 'notifyees';
        assignmentTypeDispName = notifyessTypeDispName;
    }
    return {
        assignmentType : assignmentType,
        assignmentTypeDispName : assignmentTypeDispName
    };
};

export default exports = {
    populateAssignmentTableData,
    loadAssignmentTableColumns,
    getTemplateObjectsToLoad,
    assignmentHandlerRowSelection,
    removeAssignmentHandlerAction,
    resetAssignementTableEditMode,
    autoCompleteSignoffOptions,
    saveParticipationDetails,
    addEditHandler,
    getAssignmentTypeInfoBasedOnSelection
};
