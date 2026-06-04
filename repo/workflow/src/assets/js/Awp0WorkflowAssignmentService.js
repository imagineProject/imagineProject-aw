// Copyright (c) 2022 Siemens

/**
 * @module js/Awp0WorkflowAssignmentService
 */
import appCtxSvc from 'js/appCtxService';
import awp0TasksUtils from 'js/Awp0TasksUtils';
import viewModelService from 'js/viewModelObjectService';
import clientDataModel from 'soa/kernel/clientDataModel';
import assignmentEditSvc from 'js/Awp0WorkflowAssignmentEditService';
import AwPromiseService from 'js/awPromiseService';
import soaSvc from 'soa/kernel/soaService';
import localeSvc from 'js/localeService';
import editHandlerService from 'js/editHandlerService';
import workflowAssinmentUtilSvc from 'js/Awp0WorkflowAssignmentUtils';
import workflowAssignmentPanelSvc from 'js/Awp0WorkflowAssignmentPanelService';
import notySvc from 'js/NotyModule';
import messagingSvc from 'js/messagingService';
import commandPanelService from 'js/commandPanel.service';
import _ from 'lodash';

/**
  * Define public API
  */
var exports = {};
var _NULL_ID = 'AAAAAAAAAAAAAA';

var parentData = null;
var _multiUserTasks = [ 'EPMReviewTask', 'EPMRouteTask', 'EPMAcknowledgeTask', 'EPMReviewTaskTemplate',
    'EPMRouteTaskTemplate', 'EPMAcknowledgeTaskTemplate' ];
var _RELOAD_TABLE = 'taskTreeTable.plTable.reload';

/**
  * gets local text bundle
  * @returns {Object} text bundle
  */
var _getLocalTextBundle = function() {
    var resource = '/i18n/WorkflowCommandPanelsMessages.json';
    return localeSvc.getLoadedText( resource );
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
  * Create and returns empty task assignment data that hold all assignment information.
  *
  * @returns {Object} Assignemnt data object that hold all assignment information
  */
var _createEmptyTaskDataStructure = function() {
    return {
        internalName : null,
        selectionMode: 'single',
        isRequired : false,
        taskAssignment : null,
        assignmentOrigin: null,
        assignmentType : null,
        signoffProfile : null
    };
};

/**
  * Get the view model object based on input model object if not null id then only
  * create the VMO and return else it will return null.
  * @param {Object} object input object for VMO need to be created
  *
  * @returns {Object} View model object
  */
var _getVMOObject = function( object ) {
    if( _.isObject( object ) && object.uid !== _NULL_ID ) {
        return viewModelService.createViewModelObject( object.uid );
    }
    return null;
};

/**
  *  Populate the assignemnt client data obejct based on input values and return client object.
  *
  * @param {Object} assignmentData Task specific assignment data
  * @param {String} assignmentType Assignemnt type string
  *
  * @returns {Object} Assignemnt data object that hold all assignment information
  */
var _getAssignmentObject = function( assignmentData, assignmentType ) {
    var assignmentObject = null;
    if( assignmentData && assignmentData.member && assignmentData.member.uid ) {
        var object = clientDataModel.getObject( assignmentData.member.uid );
        if( object && object.props && object.props.object_string ) {
            var viewModelObj = viewModelService.createViewModelObject( object.uid );
            if( viewModelObj ) {
                assignmentObject = _createEmptyTaskDataStructure();
                assignmentObject.taskAssignment = viewModelObj;
                assignmentObject.assignmentOrigin = _getVMOObject( assignmentData.origin );
                // Check if origin is not null then in that case we need to persist the origin for any update to that assignment
                if( assignmentObject.assignmentOrigin ) {
                    assignmentObject.isPersistedOrigin = true;
                }
                assignmentObject.assignmentType = assignmentType;
                assignmentObject.signoffProfile = awp0TasksUtils.getSignoffProfileObject( assignmentData.signoffProfile );
                assignmentObject.isRequired = assignmentData.isRequired;

                // Check if additional data is not null and server has return the isRemoveAllowed value so we need
                // to store this value on individual assignment. This is mainly needed when PS task stated then we don't
                // need to show remove command and use additional parameter objectUID in replace case. Fix for defect # LCS-675611
                if( assignmentData.additionalData ) {
                    if( assignmentData.additionalData.isRemoveAllowed && assignmentData.additionalData.isRemoveAllowed[ 0 ] ) {
                        var isRemoveAllowed = assignmentData.additionalData.isRemoveAllowed[ 0 ];
                        assignmentObject.isRemoveAllowed = isRemoveAllowed;
                    }
                    if( assignmentData.additionalData.isDecisionMade && assignmentData.additionalData.isDecisionMade[0] ) {
                        let textSource = '/i18n/InboxMessages.json';
                        let localTextBundle = localeSvc.getLoadedText(textSource);
                        assignmentObject.isDecisionMade = assignmentData.additionalData.isDecisionMade[0];
                        if( assignmentObject.isDecisionMade !== localTextBundle.no_decision ) {
                            assignmentObject.decision = 'Yes';
                        } else {
                            assignmentObject.decision = 'No';
                        }
                    }
                    // Store ObjectUID also on individual assignment object
                    if( assignmentData.additionalData.objectUID && assignmentData.additionalData.objectUID[ 0 ] ) {
                        var objectUID = assignmentData.additionalData.objectUID[ 0 ];
                        if( objectUID ) {
                            assignmentObject.objectUID = objectUID;
                        }
                    }
                }
            }
        }
    }
    return assignmentObject;
};

/**
  * Populate the task assignment and DP related assignment data and populate it correctly and
  * put it on task that this task support these DP's.
  *
  * @param {Object} assignementData Task specific assignment data
  * @param {Object} assignementDPData Task DP specific assignment data
  * @param {String} assignmentType Assignemnt type string
  * @param {Array} taskParticipantTypes Task supported DP types
  * @param {Object} participantInfoMap Particiapnt info map object
  * @param {Object} taskObj selected task object
  *
  * @returns { Object} Object that will have assignees that need to be shown along with DP types that task supports.
  */
var _populateTaskData = function( assignementData, assignementDPData, assignmentType, taskParticipantTypes, participantInfoMap ) {
    var modelObjects = [];
    let removeCommandChecks = {};
    let isRemoveReviewerPrivileged = false;
    // Iterate for assignment data array and iterate for each info and create the client task assignment
    // data structure that hold all information
    if( assignementData && assignementData[ assignmentType ] && assignementData[ assignmentType ].length > 0  ) {
        _.forEach( assignementData[ assignmentType ], function( assignment ) {
            if( assignment.additionalData ){
                if( assignment.additionalData.isRemovePrivileged && assignment.additionalData.isRemovePrivileged[0] === 'true') {
                    isRemoveReviewerPrivileged = true;
                }  
            }
            var assignmentObject = _getAssignmentObject( assignment, assignmentType );
            assignmentObject.isRemoveReviewerPrivileged = isRemoveReviewerPrivileged;
            if( assignmentObject ) {
                modelObjects.push( assignmentObject );
            }
        } );
    }
    var supportedDPTypes = [];
    // Iterate for assignment DP data array and iterate for each info and create the client task assignment
    // data structure that hold all information and populate the supported types for each property and each task
    // as well as it need to be used while updating the DP from panel what properties will be updated like assignee,
    // reviewers, acknowledgers or notifyers
    if( assignementDPData && assignementDPData[ assignmentType ] && assignementDPData[ assignmentType ].length > 0 ) {
        _.forEach( assignementDPData[ assignmentType ], function( assignmentDP ) {
            // If assignment type is assignee and it comes from DP then set the model objects for that property
            // as it will comes from DP data
            if( assignmentType === 'assignee' ) {
                modelObjects = [];
            }

            supportedDPTypes.push( assignmentDP );

            var taskDPParticipant = _.find( taskParticipantTypes, {
                internalName: assignmentDP
            } );

            // If task participant info is not present then add it to task particiapnt type map
            if( !taskDPParticipant && participantInfoMap[ assignmentDP ] ) {
                var particiapntInfoObject = participantInfoMap[ assignmentDP ];
                taskDPParticipant = {
                    internalName : particiapntInfoObject.internalName,
                    displayName :  particiapntInfoObject.displayName,
                    selectionMode: particiapntInfoObject.selectionMode,
                    participant_eligibility : particiapntInfoObject.participant_eligibility
                };
                taskParticipantTypes.push( taskDPParticipant );
            }
        } );
    }
    return {
        modelObjects: modelObjects,
        supportedDPTypes : supportedDPTypes
    };
};

/**
  * Get the unassigned VMO  object that will indicate that respective DP or unassigend profile , that is not assigend yet.
  *
  * @param {String} displayName Display value that need to be object string for unstaff VMO object
  *
  * @returns {Object} Unassiged DP object
  */
var _getUnStaffedVMOObject = function( displayName ) {
    var localeTextBundle = _getLocalTextBundle();
    var modelObject = viewModelService.constructViewModelObjectFromModelObject( null, '' );
    modelObject.uid = 'unstaffedUID';
    // Check if display name is not valid then show the empty display name
    if( !displayName ) {
        displayName = localeTextBundle.unAssigned;
    }
    modelObject.props = {
        object_string : {
            uiValues : [ displayName ]
        }
    };
    return modelObject;
};

/**
  * Get the DP primary object from input context
  *
  * @param {Object} dpObject DP object
  * @param {Object} ctx Context object
  *
  * @returns {Object} DP Primary object
  */
var _getDPPrimaryObject = function( dpObject, ctx ) {
    if( !dpObject ) {
        return null;
    }
    if( dpObject.primaryObject && dpObject.primaryObject.uid && dpObject.primaryObject.uid !== _NULL_ID ) {
        return dpObject.primaryObject;
    }
    if( ctx && ctx.taskAssignmentCtx && ctx.taskAssignmentCtx.additionalTargetData
         && ctx.taskAssignmentCtx.additionalTargetData.dp_target_object
         && ctx.taskAssignmentCtx.additionalTargetData.dp_target_object[ 0 ] ) {
        var object = clientDataModel.getObject( ctx.taskAssignmentCtx.additionalTargetData.dp_target_object[ 0 ] );
        if( object ) {
            return object;
        }
    }
    return null;
};

/**
  * Get the participant display name that need to be used as origin
  *
  * @param {Object} participantValue Particiapnt object
  *
  * @returns {String} Display name string
  */
var _getParticipantDisplayName = function( participantValue, i18n ) {
    var ctx = appCtxSvc.ctx;

    // Check if input participant object is null then return empty string from here
    if( !participantValue ) {
        return '';
    }

    var dpPrimaryObject = _getDPPrimaryObject( participantValue, ctx );

    // Below change is for PR LCS-234054. For Plant Problem Report the display name of participant should be Implementer and Responsible User
    if( ctx && dpPrimaryObject && dpPrimaryObject.modelType
         && dpPrimaryObject.modelType.typeHierarchyArray.indexOf( 'Pdm1ProblemItemRevision' ) > -1 ) {
        if( participantValue.internalName === 'Analyst' && i18n
         && i18n.implementer ) {
            return i18n.implementer;
        } else if( participantValue.internalName === 'ChangeSpecialist1' && i18n
         && i18n.responsibleUser ) {
            return i18n.responsibleUser;
        }
    }
    return participantValue.displayName;
};

/**
  * Populate DP data for task and update the participant info map that will store property
  * along with DP assignmetn values.
  *
  * @param {Array} taskDPDataArray Task data rray that will contain all DP values
  * @param {Object} partcipantInfoMap Particiapnt info map object where information will be stored.
  */
var _populateTasksAssignmentsDPData = function( taskDPDataArray, partcipantInfoMap, i18n ) {
    if( !taskDPDataArray ) {
        return;
    }
    // Iterate for all particiapnt type and then populate the data for that type
    for ( var participantKey in taskDPDataArray ) {
        var participantValue = taskDPDataArray[ participantKey ];
        var participantObjects = [];
        if( partcipantInfoMap[ participantKey ] ) {
            continue;
        }

        var participantAssignees = participantValue.assigneeList;
        var participant_eligibility = null;
        if( participantValue && participantValue.additionalData && participantValue.additionalData.participant_eligibility
             && participantValue.additionalData.participant_eligibility[ 0 ] ) {
            participant_eligibility = participantValue.additionalData.participant_eligibility[ 0 ];
        }
        // Check if specific participant type assignees is empty then we need to show
        // unassiged in the table
        if( !participantAssignees || participantAssignees.length === 0 ) {
            participantAssignees = [];
            var modelObject = _getUnStaffedVMOObject();
            participantAssignees.push( modelObject );
        }
        var selectionMode = 'single';
        if( participantValue.allowMultipleAssignee ) {
            selectionMode = 'multiple';
        }
        var dpDisplayName = _getParticipantDisplayName( participantValue, i18n );
        if( participantAssignees && participantAssignees.length > 0 ) {
            _.forEach( participantAssignees, function( assignee ) {
                let participantObject = _createEmptyTaskDataStructure();
                participantObject.internalName = participantValue.internalName;
                let viewObject = null;
                if ( assignee.uid !== 'unstaffedUID' ) {
                    viewObject = viewModelService.createViewModelObject( assignee.uid );
                }
                if( !viewObject && assignee ) {
                    viewObject = assignee;
                }
                participantObject.taskAssignment = viewObject;
                participantObject.assignmentOrigin = dpDisplayName;
                participantObject.selectionMode = selectionMode;
                participantObjects.push( participantObject );
            } );
        }


        // Create the participant info object that will have all info for specific participant type
        var participantInfoObject = {
            internalName : participantValue.internalName,
            displayName : dpDisplayName,
            primaryObj : participantValue.primaryObject,
            allowMultipleAssignee : participantValue.allowMultipleAssignee,
            selectionMode : selectionMode,
            assignees : participantObjects,
            participant_eligibility : participant_eligibility
        };
        partcipantInfoMap[ participantKey ] = participantInfoObject;
    }
};

/**
  * Populate the task profile VMO object and return all profiles.
  * @param {Array} assignmentData Assignment data object that will store all task specific
  *  profiles present on task.
  *
  * @returns {Array} Task Profile VMO objects
  */
var _populateTaskProfiles = function( assignmentData ) {
    // Check if assignment data is not valid or don't have any profile then return from here
    if( !assignmentData || !assignmentData.profiles || assignmentData.profiles.length <= 0 ) {
        return null;
    }
    var profileObjects = [];
    _.forEach( assignmentData.profiles, function( profileInfo ) {
        var profileObject = awp0TasksUtils.getSignoffProfileObject( profileInfo.signoffProfile );
        if( profileObject ) {
            profileObjects.push( profileObject );
        }
    } );
    return profileObjects;
};

/**
  * Populate the task assignment data based on input values and return the task assignment data object
  * that will have all tasks that need to be shown and their assignment information.
  *
  * @param {Array} taskDataValues Task assignment data array
  * @param {Object} taskAssignmentDataMap Task assignemnt data obejct that will hold task info.
  *
  * @returns {Object} Task assignment data object
  */
export let populateTaskAssignmentData = function( taskDataValues, taskAssignmentDataMap, i18n ) {
    if( taskAssignmentDataMap === undefined || !taskAssignmentDataMap ) {
        taskAssignmentDataMap = {
            childTaskObjects : [],
            taskInfoMap : {},
            participantInfoMap : {},
            palInfoMap : {},
            allTasksObjects : []
        };
    }
    var allTasksObjects = taskAssignmentDataMap.allTasksObjects;
    var childTaskObjects = [];
    var taskInfoMap = taskAssignmentDataMap.taskInfoMap;
    var participantInfoMap = taskAssignmentDataMap.participantInfoMap;

    // Populate all DP's data into map
    _populateTasksAssignmentsDPData( taskDataValues.dpData, participantInfoMap, i18n );

    // Populate all tasks related assignment data for each property
    _.forEach( taskDataValues.outData, function( taskData ) {
        var taskParticipantTypes = [];

        // Populate all properties that need to be shown on table
        var assigneeData = _populateTaskData( taskData.assigmentData, taskData.additionalData, 'assignee',  taskParticipantTypes, participantInfoMap, taskData.task );
        var reviewersData = _populateTaskData( taskData.assigmentData, taskData.additionalData, 'reviewers',  taskParticipantTypes, participantInfoMap, taskData.task );
        var acknowledgersData = _populateTaskData( taskData.assigmentData, taskData.additionalData, 'acknowledgers',  taskParticipantTypes, participantInfoMap, taskData.task );
        var notifyeesData = _populateTaskData( taskData.assigmentData, taskData.additionalData, 'notifyees', taskParticipantTypes, participantInfoMap, taskData.task );

        // Populate task profiles info
        var taskProfiles = _populateTaskProfiles( taskData.assigmentData );
        var object = {
            props : {
                assignee :  assigneeData,
                reviewers :  reviewersData,
                acknowledgers :  acknowledgersData,
                notifyees :  notifyeesData
            },
            taskDeferredParticipantsTypes : taskParticipantTypes,
            taskProfiles : taskProfiles
        };

        var taskUid = taskData.task.uid;

        taskInfoMap[ taskUid ] = object;

        // Create VMO for task object that need to be shown on table
        var viewObject = viewModelService.createViewModelObject( taskUid );
        if( viewObject  ) {
            var viewModelObjectExist = _.find( allTasksObjects, {
                uid : viewObject.uid
            } );
            if( !viewModelObjectExist ) {
                allTasksObjects.push( viewObject );
            }
            childTaskObjects.push( viewObject );
            taskAssignmentDataMap.childTaskObjects = childTaskObjects;
        }
    } );
    return taskAssignmentDataMap;
};


/**
  * Update the assignemtn origin if coming from project or resource pool.
  *
  * @param {Object} assignmentObject Object that need be assigned
  * @param {Object} newAssignmentObject new task assignment client object
  */
var _updateTaskAssignmentOrigin = function( assignmentObject, newAssignmentObject ) {
    if( newAssignmentObject && assignmentObject && !newAssignmentObject.assignmentOrigin ) {
        if( assignmentObject.projectObject ) {
            newAssignmentObject.assignmentOrigin = assignmentObject.projectObject;
        } else if( isOfType( assignmentObject, 'ResourcePool' ) ) {
            newAssignmentObject.assignmentOrigin = _.cloneDeep( assignmentObject );
        }
    }
};

/**
  * check if a origin is PAL and it matches with user applied pAL on UI then return true else return false.
  * So if user did not apply PAL and origin is PAL then it need to be added normally on task info map and not on
  * pal info map object.
  *
  * @param {Object} assignmentOrigin Check if origin is not null and its PAL object
  * @param {Object} palInfoMap Map that contains all PAL related info.
  *
  * @returns {boolean} True/False
  */
var _isUserAppliedPAL = function( assignmentOrigin, palInfoMap ) {
    if( assignmentOrigin && isOfType( assignmentOrigin, 'EPMAssignmentList' ) && palInfoMap &&  palInfoMap.hasOwnProperty( assignmentOrigin.uid ) ) {
        return true;
    }
    return false;
};

/**
  * Get the index for input assignmentObject in array to determine if this is new
  * assignment or old assignment.
  * @param {Array} modelObjects Model objects where assignment need to find out
  * @param {Object} assignmentObject Assignment object for uid need to match
  * @returns {object} Index if found in input array
  */
var _findExistingAssignmentIndex = function( modelObjects, assignmentObject ) {
    var idx = -1;
    idx = _.findIndex( modelObjects, function( modelObject ) {
        if( modelObject.assignmentObject && modelObject.assignmentObject.taskAssignment ) {
            // Check the UID or uniqueUid ( only present for resource pool case) to handle the previous
            // enteries index and new entry index so that new values can be shown as dirty background
            return modelObject.assignmentObject.taskAssignment.uid === assignmentObject.uid
             || modelObject.assignmentObject.taskAssignment.uid === assignmentObject.uniqueUid;
        }
        return modelObject.taskAssignment && modelObject.taskAssignment.uid === assignmentObject.uid;
    } );
    return idx;
};

/**
  * Populate all task assignment for specific input assignemnt type and return the final
  * array that will contain all assignments like old and new ones.
  *
  * @param {Array} assignmentObjects Present Model objects as current task assignemnt.
  * @param {String} assignmentType Assignemnt type string value
  * @param {boolean} isReview True or false
  * @param {Object} palTaskAssignment Pal task assignment data object that will store all PAL assignment update info
  * @param {Object} palInfoMap PAL info map object
  *
  * @returns {Array} Task assignement object array
  */
var createTaskAssignmentObjects = function( assignmentObjects, assignmentType, isReview, palTaskAssignment, palInfoMap ) {
    var taskAssignemnts = [];
    var palAssignments = [];
    if( assignmentObjects && assignmentObjects.length > 0 ) {
        for( var idx = 0; idx < assignmentObjects.length; idx++ ) {
            // Check if assignment is of profile or key role coming from panel then no need to process and update the assignment maps
            if( isReview && isOfType( assignmentObjects[idx], 'EPMSignoffProfile' ) || assignmentObjects[idx].type === 'KeyRole'
                 || assignmentObjects[idx].requiredDispValue ) {
                continue;
            }

            var valueUpdated = true;
            var assignmentObject = assignmentObjects[ idx ].assignmentObject;
            if( assignmentObject && assignmentObject.internalName ) {
                continue;
            }

            if( assignmentObjects && assignmentObjects.length > 0 ) {
                var index1 = _findExistingAssignmentIndex( assignmentObjects, assignmentObjects[ idx ] );
                if( index1 > -1 && assignmentObjects[ index1 ] ) {
                    valueUpdated = false;
                    // Check if valueUpdated value is present and true then change the value to true as save doesn't happen yet.
                    if( assignmentObjects[ index1 ].taskAssignment && assignmentObjects[ index1 ].taskAssignment.valueUpdated ) {
                        valueUpdated = assignmentObjects[ index1 ].taskAssignment.valueUpdated;
                    }
                }
            }
            // Check if assignment object is not null and then check for taskAssignment is not null then get the
            // valueUpdated value to indicate that this is new value or old so that we can show correct edit status on table.
            if( assignmentObject && assignmentObject.taskAssignment && assignmentObject.taskAssignment.valueUpdated ) {
                valueUpdated = assignmentObject.taskAssignment.valueUpdated;
            }
            var newAssignment = _createEmptyTaskDataStructure();
            // Check if assignment object is not null then create a copy of that assignment so that
            // it will have correct assignment data
            if( assignmentObject ) {
                newAssignment = _.cloneDeep( assignmentObject );
            }
            newAssignment.taskAssignment = assignmentObjects[idx];
            newAssignment.taskAssignment.valueUpdated = valueUpdated;
            newAssignment.assignmentType = assignmentType;
            newAssignment.signoffProfile = !_.isUndefined( assignmentObjects[idx].signoffProfile ) ? assignmentObjects[idx].signoffProfile : null;

            if( assignmentObject ) {
                newAssignment.assignmentOrigin = assignmentObject.assignmentOrigin;
            }

            if( newAssignment.assignmentOrigin && _isUserAppliedPAL( newAssignment.assignmentOrigin, palInfoMap ) ) {
                // This is needed for when user apply some pal and then open the asignment panel and made some modification
                // and then for PAL assignment this need to be set so that we can use it for remove or replace cases
                newAssignment.isPALAssignment = true;
                palAssignments.push( newAssignment );
                continue;
            }
            // Update the new assignment origin if coming from project or resource pool
            _updateTaskAssignmentOrigin( assignmentObjects[ idx ], newAssignment );
            taskAssignemnts.push( newAssignment );
        }
    }

    // PAL info population
    _.forEach( palAssignments, function( palAssignment ) {
        var palId = palAssignment.assignmentOrigin.uid;
        var palInfoObject = palTaskAssignment[ palId ];
        if( !palInfoObject ) {
            palInfoObject = {};
            var object =  {};
            object[ assignmentType ] = [];
            palInfoObject[ assignmentType ] = [];
        }
        var assignmentObjects =  palInfoObject[ assignmentType ];
        if( !assignmentObjects ) {
            assignmentObjects = [];
            palInfoObject[ assignmentType ] = assignmentObjects;
        }
        assignmentObjects.push( palAssignment );
        palTaskAssignment[ palId ] = palInfoObject;
    } );

    return {
        taskAssignemnts: taskAssignemnts,
        palTaskAssignment : palTaskAssignment
    };
};


/**
  * Update the edit context to store task being edited.
  *
  * @param {Object} context COntext object that store all edit assignemtn information
  * @param {String} taskUid Task uid string that has been edited
  *
  * @returns {Object} Context object
  */
var _updateEditContext = function( context, taskUid ) {
    if( !context ) {
        return;
    }
    context.isStartEditEnabled = true;
    context.isModified = true;
    if( !context.updatedTaskObjects ) {
        context.updatedTaskObjects = [];
    }
    if( context.updatedTaskObjects ) {
        var idx = _.findIndex( context.updatedTaskObjects, function( updatedTaskObject ) {
            return updatedTaskObject === taskUid;
        } );
        if( idx <= -1 ) {
            context.updatedTaskObjects.push( taskUid );
        }
    }
    return context;
};

/**
  * Create the SOA input structure that will have root task and all applied PALs info and these
  * will be used when there are unloaded tasks in tree and there are some PAL assignment then those
  * assignment need to happen on server.
  *
  * @param {Object} taskAssignmentObject Task assignment obejct that have all tasks and their info
  * @param {Array} inData inData array that will have SOA info
  */
var _createAppliedPALInputData = function( taskAssignmentObject, inData ) {
    // Check if pal is applied then only process further else return from here
    if( !taskAssignmentObject || !taskAssignmentObject.palInfoMap || _.isEmpty( taskAssignmentObject.palInfoMap )
     || !taskAssignmentObject.allTasksObjects || !taskAssignmentObject.allTasksObjects[ 0 ] ) {
        return;
    }

    // Get the first task and that will be used to get the root task and it will
    // be pass to server
    var taskObject = taskAssignmentObject.allTasksObjects[ 0 ];
    var rootTaskObject = null;
    if( taskObject && taskObject.props && taskObject.props.root_task.dbValues
         && taskObject.props.root_task.dbValues[ 0 ] ) {
        rootTaskObject = clientDataModel.getObject( taskObject.props.root_task.dbValues[ 0 ] );
    }
    var palIdArray = [];
    // Add all applied PALs from PAL info map
    for( var palId in taskAssignmentObject.palInfoMap ) {
        palIdArray.push( palId );
    }
    // Add all info to SOA input strucutre and return that structure
    if( rootTaskObject && palIdArray && palIdArray.length > 0 ) {
        var object = {
            taskData : {
                task: rootTaskObject
            },
            clientId : rootTaskObject.uid,
            additionalData : {
                PALs : palIdArray
            }
        };
        inData.push( object );
    }
};

/**
  * Save the assignment info into the system.
  *
  * @param {Object} assignmentStateContext Assignment state context object where we need to fetch updated
  *                 info and save it.
  * @returns {Promise} Promise object
  */
export let saveTaskAssignments = function( assignmentStateContext ) {
    // Check if context info is invalid then no need to process further and return from here
    var deferred = AwPromiseService.instance.defer();
    if( !assignmentStateContext || !assignmentStateContext.taskAssignmentDataObject ) {
        return deferred.resolve();
    }

    var taskAssignmentObject = assignmentStateContext.taskAssignmentDataObject;

    var inData = [];
    var updatedTaskUids = assignmentStateContext.updatedTaskObjects;
    var updatedTaskObjects = [];
    _.forEach( updatedTaskUids, function( taskUid ) {
        var taskObject = clientDataModel.getObject( taskUid );
        if( taskObject ) {
            updatedTaskObjects.push( taskObject );
        }
    } );
    taskAssignmentObject = exports.populateAssignmentTableRowData( taskAssignmentObject, updatedTaskObjects );
    if( !taskAssignmentObject ) {
        return deferred.resolve();
    }
    var taskInfoMap = taskAssignmentObject.taskInfoMap;
    var participantInfoMap = taskAssignmentObject.participantInfoMap;
    var updatedDPTypes = [];
    _updateTaskSOAInputStructure( updatedTaskUids, taskInfoMap, inData, updatedDPTypes );
    _updateDPSOAInputStructure( updatedDPTypes, participantInfoMap, inData );
    _createAppliedPALInputData( taskAssignmentObject, inData );
    var soaInput = {
        inData : inData
    };
    // Check if SOA input is not valid then don't call SOA and return empty result from here
    if( !soaInput || !soaInput.inData || soaInput.inData.length <= 0 ) {
        return deferred.resolve();
    }
    soaSvc.postUnchecked( 'Internal-Workflowaw-2020-12-Workflow', 'updateWorkflowTaskAssignments', soaInput ).then(
        function( response ) {
            //Parse the SOA data to content the correct user or resource pool data
            var message = workflowAssinmentUtilSvc.getErrorMessage( response );

            if( message && message.length > 0 ) {
                notySvc.showError( message );
            }
            deferred.resolve();
        },
        function( error ) {
            deferred.reject( error );
        } );
    return deferred.promise;
};

/**
  * Check for task assignment panel is up or not either tool and info or as popup panel.
  *
  * @returns {boolean} True/False
  */
var _isAssignmentPanelOpened = function() {
    var ctx = appCtxSvc.ctx;
    if( ctx && ctx.activeToolsAndInfoCommand && ctx.activeToolsAndInfoCommand.commandId === 'Awp0TaskAssignmentCommandPanel' ) {
        return true;
    }
    return false;
};


/**
  * Set edit handler to hold the information and that info will be used
  * for save the info.
  * @param {Object} contextObject Custom context object
  */
export let setEditHandlerContext = function( contextObject ) {
    // Check if context object is not null start edit is enabled then only process
    // further else return from here.
    if( !contextObject || !contextObject.isStartEditEnabled ) {
        return;
    }

    var editHandler = editHandlerService.getEditHandler( 'TASK_ROW_EDIT' );
    // Get the edit handler and if not null then cancel all edits
    // if( editHandler ) {
    //     return;
    // }

    var _resetEditContext = function( isRemoveReload ) {
        // Check if assignment panel is up then close it.
        if( _isAssignmentPanelOpened() ) {
            commandPanelService.activateCommandPanel( 'Awp0TaskAssignmentCommandPanel', 'aw_toolsAndInfo' );
        }

        // Set the edit mode on workflow assignment state object to false and reload the table correctly from server
        // data.
        if( isRemoveReload === undefined || !isRemoveReload ) {
            const localState = { ...contextObject.value };
            localState.parentChildMap = null;
            localState.taskAssignmentDataObject = null;
            localState.isReloadTable = true;
            localState.isStartEditEnabled = false;
            localState.isModified = false;
            localState.selectedPals = [];
            contextObject.update && contextObject.update( localState );
        }
    };

    var saveEditFunc = function( isRemoveReload ) {
        // function that returns a promise.
        var deferred = AwPromiseService.instance.defer();
        // Setting this variable to false as we don't want to reload the table right away and
        // this will be handled differently. So by default setting thsi variable as
        // false. Updating the table if user click on saveEdits using command that will be handled
        // using primaryWorkArea.reset event and if there is some unsaved edit and user click on
        // save notification then we don't want to reload the table after navigating to some other tab
        // or some other location.
        contextObject.isReloadTable = false;
        exports.saveTaskAssignments( contextObject ).then( function() {
            _resetEditContext( isRemoveReload );
            deferred.resolve( {} );
        } );
        return deferred.promise;
    };

    var cancelEditFunc = function( isRemoveReload ) {
        // function that returns a promise.
        var deferred = AwPromiseService.instance.defer();
        _resetEditContext( isRemoveReload );
        deferred.resolve( {} );
        return deferred.promise;
    };

    //create Edit Handler
    assignmentEditSvc.createEditHandlerCustomContext( {}, null, saveEditFunc, cancelEditFunc, 'TASK_ROW_EDIT', contextObject.isModified, contextObject );
};

/**
  * Register the edit handler when user click on start edit command.
  *
  * @param {Object} contextObject Assignment state context object.
  */
export let registerEditHandlerContext = function( contextObject ) {
    if( contextObject ) {
        // Set the isStartEditEnabled to true so that it can create edit handler.
        // This is temporary solution and need to be reworked.
        contextObject.isStartEditEnabled = true;
        exports.setEditHandlerContext( contextObject );
    }
};

/**
  * Get the current active edit handler and call save edits on that handler
  *
  * @returns {Promise} Promise object
  */
export let saveEdits = function() {
    var defer = AwPromiseService.instance.defer();
    var editHandler = editHandlerService.getActiveEditHandler();
    if( editHandler ) {
        // Passing additional parameter to save edit or cancel edit function
        // in case we are showing the notification message and in that case we don't want to reload
        // the same page again for same component
        editHandler.saveEdits( false, false ).then( function() {
            defer.resolve();
        }, function() {
            defer.resolve();
        } );
    }
    return defer.promise;
};

/**
  * Create the DP SOA input structure for DP's need to be updated.
  *
  * @param {Array} updatedDPTypes DP types that need to be updated
  * @param {Object} participantInfoMap participant map object that will hold all participant information
  * @param {Array} inData SOA input data array
  */
var _updateDPSOAInputStructure = function( updatedDPTypes, participantInfoMap, inData ) {
    if( !updatedDPTypes || updatedDPTypes.length <= 0 || !participantInfoMap || !inData ) {
        return;
    }
    // Update for each DP, get the info from participant map and create the input structure
    // that will be used to create the DP's on target
    _.forEach( updatedDPTypes, function( dpType ) {
        var assigneeObjects = [];
        var participantInfoObject = participantInfoMap[ dpType ];
        var participantObjects = participantInfoObject.assignees;
        var primaryObj = participantInfoObject.primaryObj;
        _.forEach( participantObjects, function( modelObject ) {
            if( modelObject.taskAssignment && modelObject.taskAssignment.type ) {
                var taskAssignment = modelObject.taskAssignment;
                // Right now we are using it as workaroud for duplicate resource pool cases when duplicate
                // resource pools added to one aw-list component then because of uid check in component, there
                // is one issue to render it correctly. So to handle it we update the uid with some random number
                // to make it unique and then added uniqueUid to contain the original UID for resource pool.
                if( taskAssignment.uniqueUid ) {
                    taskAssignment = clientDataModel.getObject( taskAssignment.uniqueUid );
                }
                assigneeObjects.push( taskAssignment );
            }
        } );
        var targetObject = null;

        if( primaryObj ) {
            targetObject = {
                uid: primaryObj.uid,
                type: primaryObj.type
            };
        }
        var dpObject = {
            primaryObject: targetObject,
            internalName : dpType,
            assigneeList : assigneeObjects
        };
        var object = {
            dpData : dpObject,
            clientId: dpType
        };
        inData.push( object );
    } );
};

/**
  * Create the task specific SOA input structure
  * @param {Array} updatedTaskUids Task uids that are updated
  * @param {Object} taskInfoMap Task info amp obejct that hold task information
  * @param {Array} inData SOA input data array
  * @param {Array} updatedDPTypes DP types array that need to be populated that these tasks are using DP's.
  */
var _updateTaskSOAInputStructure = function( updatedTaskUids, taskInfoMap, inData, updatedDPTypes ) {
    _.forEach( updatedTaskUids, function( taskUid ) {
        var taskInfoObject = taskInfoMap[ taskUid ];
        var assignmentData = {};

        if( taskInfoObject ) {
            for( var propName in taskInfoObject.props ) {
                var modelObjects = taskInfoObject.props[ propName ].modelObjects;
                var propModelObjects = [];
                _.forEach( modelObjects, function( modelObject ) {
                    if( modelObject.internalName ) {
                        var index1 = _.findIndex( updatedDPTypes, function( dpType ) {
                            return dpType === modelObject.internalName;
                        } );
                        if( index1 <= -1 ) {
                            updatedDPTypes.push( modelObject.internalName );
                        }
                    } else {
                        if( modelObject.taskAssignment && modelObject.taskAssignment.uid !== 'unstaffedUID' ) {
                            var taskAssignment = modelObject.taskAssignment;
                            var originObject = modelObject.assignmentOrigin;
                            // Right now we are using it as workaroud for duplicate resource pool cases when duplicate
                            // resource pools added to one aw-list component then because of uid check in component, there
                            // is one issue to render it correctly. So to handle it we update the uid with some random number
                            // to make it unique and then added uniqueUid to contain the original UID for resource pool.
                            if( taskAssignment.uniqueUid ) {
                                taskAssignment = clientDataModel.getObject( taskAssignment.uniqueUid );
                            }
                            // Same as above case as well to handle resource pools correctly.
                            if( originObject && originObject.uniqueUid ) {
                                originObject = clientDataModel.getObject( originObject.uniqueUid );
                            }
                            var object = {
                                member : taskAssignment,
                                signoffProfile : modelObject.signoffProfile,
                                isRequired : modelObject.isRequired,
                                origin : originObject,
                                additionalData : {}
                            };
                            // Check if objectUID is prenset on model object then we need to pass it to server
                            // as well so server can figure out that it's replace signoff case or new signoff case
                            if( modelObject.objectUID && !_.isEmpty(  modelObject.objectUID ) ) {
                                object.additionalData.objectUID = [ modelObject.objectUID ];
                            }
                            propModelObjects.push( object );
                        }
                    }
                } );
                if( propModelObjects && propModelObjects.length > 0 ) {
                    assignmentData[ propName ] = propModelObjects;
                }
            }
            var taskObject = clientDataModel.getObject( taskUid );
            if( taskObject ) {
                var object = {
                    taskData : {
                        task: taskObject,
                        assigmentData : assignmentData
                    },
                    clientId : taskUid
                };
                inData.push( object );
            }
        }
    } );
};


/**
  * Remove the object from input array and if input add object is not null then add it as well.
  *
  * @param {Array} presentObjects Present objects where we need to add or remove
  * @param {Object} toRemove Object that need to be removed
  * @param {Object} toAdd Object that need to be added
  */
var _removeObject = function( presentObjects, toRemove, toAdd ) {
    var index = _.findIndex( presentObjects, function( object ) {
        return object.taskAssignment.uid === toRemove.taskAssignment.uid;
    } );
    if( index > -1 ) {
        if( toAdd && !_.isArray( toAdd ) ) {
            presentObjects.splice( index, 1, toAdd );
        } else {
            presentObjects.splice( index, 1 );
        }
        // Check if object that need to be added as array then we need to add the whole array to present
        // object. This change has been done as part of defect # LCS-464547
        if( toAdd && _.isArray( toAdd ) ) {
            Array.prototype.push.apply( presentObjects, toAdd );
        }
    } else if( toAdd && !_.isArray( toAdd ) ) {
        presentObjects.push( toAdd );
    }
};

/**
  * Remove the selected assignment information and update the info in cache.
  *
  * @param {Object} selected Selected Assignment object that need to be removed
  * @param {Object} assignmentStateContext Assignment context
  */
export let removeTaskAssignment = function( selected, assignmentStateContext ) {
    if( !selected || !selected.type || !selected.uid || !assignmentStateContext || !assignmentStateContext.taskAssignmentDataObject ) {
        return;
    }

    var assignmentContext = { ...assignmentStateContext.value };

    assignmentContext = _updateEditContext( assignmentContext, selected.taskUid );

    var taskAssignmentObject = assignmentContext.taskAssignmentDataObject.taskInfoMap[ selected.taskUid ];
    var removeAssignmentObject = selected.assignmentObject;
    var isPalAssignment = removeAssignmentObject.isPALAssignment;
    var isDPAssignment = removeAssignmentObject.internalName !== null;

    var profileObject = removeAssignmentObject.signoffProfile;

    if( profileObject ) {
        // Check if profile object is not VMO then create the VMO object first and then
        // increment the count.
        if( !viewModelService.isViewModelObject( profileObject ) ) {
            profileObject = viewModelService.createViewModelObject( profileObject );
            profileObject.requiredReviewers = profileObject.props.number_of_signoffs.dbValues[ 0 ] + ' ' + parentData.i18n.required;
        }
        var splitValues = profileObject.requiredReviewers.split( ' ' );
        if( splitValues && splitValues.length === 2 && splitValues[ 0 ] && splitValues[ 1 ] ) {
            var reviewersNeeded = parseInt( splitValues[ 0 ] );
            profileObject.requiredReviewers = reviewersNeeded + 1 + ' ' + splitValues[ 1 ];
        }
    }

    if( isPalAssignment && removeAssignmentObject.assignmentOrigin.hasOwnProperty( 'uid' ) ) {
        var palUid = removeAssignmentObject.assignmentOrigin.uid;
        taskAssignmentObject = assignmentContext.taskAssignmentDataObject.palInfoMap[ palUid ][ selected.taskUid];
    }
    var presentObjects = taskAssignmentObject.props[removeAssignmentObject.assignmentType].modelObjects;
    _removeObject( presentObjects, removeAssignmentObject );
    taskAssignmentObject.props[removeAssignmentObject.assignmentType].modelObjects = presentObjects;

    var participantInfoMap =  assignmentContext.taskAssignmentDataObject.participantInfoMap;
    if( isDPAssignment && participantInfoMap[ removeAssignmentObject.internalName ] ) {
        var participantObjects = participantInfoMap[ removeAssignmentObject.internalName ].assignees;
        _removeObject( participantObjects, removeAssignmentObject );
        // If all DP participant is removed then add the unassiged DP.
        if( participantObjects && participantObjects.length === 0 ) {
            var modelObject = _getUnStaffedVMOObject();

            var existingParticipant = _createEmptyTaskDataStructure();

            existingParticipant.internalName = removeAssignmentObject.internalName;
            existingParticipant.taskAssignment = modelObject;
            existingParticipant.assignmentOrigin = removeAssignmentObject.assignmentOrigin;
            existingParticipant.assignmentType = removeAssignmentObject.assignmentType;

            participantObjects.push( existingParticipant );
        }
    }

    // Set this to true so that table can be reloaded.
    assignmentContext.isReloadTable = true;
    assignmentStateContext.update && assignmentStateContext.update( assignmentContext );
};

/**
  * Get all group member elements present in current data provider and update the
  * input list only.
  *
  * @param {Array} reviewerList Data provider object whose objects need to be checked
  * @param {Array} addedObjects Objects that need to be added
  * @returns {Array} addedObjects array that contains all group memebrs objects present.
  */
var _presentGroupMemberReviewers = function( reviewerList, addedObjects ) {
    if( !reviewerList || reviewerList.length <= 0 ) {
        return addedObjects;
    }

    _.forEach( reviewerList, function( modelObject ) {
        if( modelObject.taskAssignment && isOfType( modelObject.taskAssignment, 'GroupMember' ) && !modelObject.internalname ) {
            addedObjects.push( modelObject );
        }
    } );
    return addedObjects;
};

/**
  * Check if user is trying to add duplicate reviewer or not and based on that return true or false
  *
  * @param {Object} taskAssignmentObject Assignmetn obejct that will contain all properties
  * @param {Object} selectedObjects Object that is being repalced
  * @param {String} assignmentType Assignemtn type that need to be checked
  * @param {Object} data Data vie wmodle object
  *
  * @returns {Array} Valid object that need to be added
  */
var _getValidObjectToAdd = function( taskAssignmentObject, selectedObjects, assignmentType ) {
    // Check if assignment type is assignee or assignment object is not valid then no need to process further
    // and return the input selected objects as valid objects.
    if( !taskAssignmentObject || !taskAssignmentObject.props || assignmentType === 'assignee' ) {
        return selectedObjects;
    }
    var addedObjects = [];
    // Populate the reviewers, acknowledgers and notifyees were user is trying to add or replace users
    var propNames = [ 'reviewers', 'acknowledgers', 'notifyees' ];
    _.forEach( propNames, function( propName ) {
        if( taskAssignmentObject.props[ propName ] ) {
            _presentGroupMemberReviewers( taskAssignmentObject.props[ propName ].modelObjects, addedObjects );
        }
    } );
    var objectsAlreadyAdded = [];
    var validObjects = [];
    // Get all objects that are new obejct to add and already object list and
    // that list will be used to show the error and other objects will be used for adding.
    _.forEach( selectedObjects, function( selectedObject ) {
        var objectIdx = _.findIndex( addedObjects, function( object ) {
            return object.taskAssignment.uid === selectedObject.uid;
        } );
        if( objectIdx > -1 ) {
            objectsAlreadyAdded.push( selectedObject );
        } else {
            validObjects.push( selectedObject );
        }
    } );
    if( objectsAlreadyAdded && objectsAlreadyAdded.length > 0 ) {
        // Set the selected objects on data object and it will be used for duplicate validation
        var message = awp0TasksUtils.getDuplicateErrorMessage( objectsAlreadyAdded, selectedObjects );
        messagingSvc.showError( message );
    }
    return validObjects;
};

/**
  * Replace the selected assignment information and update the info in cache.
  *
  * @param {Object} data Data view model object
  * @param {Object} selectedAssignment Selected Assignment object that need to be removed
  * @param {Object} ctx App context object
  * @param {Object} context Assignment context
  */
export let replaceTaskAssignment = function( selectedAssignment, replaceAssignmentUser, assignmentStateContext ) {
    var assignmentContext = { ...assignmentStateContext.value };
    assignmentContext = _updateEditContext( assignmentContext, selectedAssignment.taskUid );

    // context = _updateEditContext( context, selectedAssignment.taskUid );
    var participantInfoMap = assignmentContext.taskAssignmentDataObject.participantInfoMap;
    var selectedObject = replaceAssignmentUser;

    var replaceAssignmentObject = selectedAssignment.assignmentObject;
    var isPalAssignment = replaceAssignmentObject.isPALAssignment;
    var isDPAssignment = replaceAssignmentObject.internalName !== null;
    var taskAssignmentObject = assignmentContext.taskAssignmentDataObject.taskInfoMap[ selectedAssignment.taskUid ];

    var newAssignment = _.cloneDeep( replaceAssignmentObject );
    newAssignment.taskAssignment = selectedObject;
    newAssignment.taskAssignment.valueUpdated = true;

    // Check is user is trying to remove the assignment that came from PAL then get the
    // info from pal info map and new assignment will go as normal assignment and it will not reference
    // to PAL.
    if( isPalAssignment && replaceAssignmentObject.assignmentOrigin.hasOwnProperty( 'uid' ) ) {
        var palUid = replaceAssignmentObject.assignmentOrigin.uid;
        taskAssignmentObject = assignmentContext.taskAssignmentDataObject.palInfoMap[ palUid ][ selectedAssignment.taskUid ];
        newAssignment.isPALAssignment = false;
    }

    // Check if user is replaing DP particiapnt then DP map need to be updated else task info map
    // need to be updated with repalce assignemnt information.
    if( isDPAssignment && participantInfoMap[ replaceAssignmentObject.internalName ] ) {
        var participantObjects = participantInfoMap[ replaceAssignmentObject.internalName ].assignees;
        var selectionMode = participantInfoMap[ replaceAssignmentObject.internalName ].selectionMode;
        if( selectionMode === 'multiple' ) {
            // Check if new assignment is already added as assignment for this DP then no need to
            // add twice and show the error to user
            var isAlreadyExistIdx = _.findIndex( participantObjects, function( participant ) {
                return participant.taskAssignment.uid === selectedObject.uid;
            } );
            // Check if user assignemnt that we are trying to replace is already exist then show the error
            // and return from here
            if( isAlreadyExistIdx > -1 ) {
                var message = awp0TasksUtils.getDuplicateErrorMessage( [ selectedObject ] );
                messagingSvc.showError( message );
                return;
            }
        }
        _removeObject( participantObjects, replaceAssignmentObject, newAssignment );

        var index1 = _.findIndex( participantObjects, function( participant ) {
            return participant.taskAssignment.uid === replaceAssignmentObject.taskAssignment.uid;
        } );
        if( index1 > -1 ) {
            participantObjects[index1].taskAssignment = selectedObject;
            participantObjects[index1].taskAssignment.valueUpdated = true;
        }
    } else {
        var assignmentType = replaceAssignmentObject.assignmentType;
        var presentObjects = taskAssignmentObject.props[ assignmentType ].modelObjects;
        if( isPalAssignment ) {
            taskAssignmentObject = assignmentContext.taskAssignmentDataObject.taskInfoMap[ selectedAssignment.taskUid ];
            presentObjects = taskAssignmentObject.props[ assignmentType ].modelObjects;
        }
        // Check if isPersistedOrigin is undefined or false then we need to reset the origin
        if( newAssignment.assignmentOrigin && !newAssignment.isPersistedOrigin ) {
            newAssignment.assignmentOrigin = null;
        }

        // Check for duplicate reviwer is being repalced if any
        var validObjectToAdd = _getValidObjectToAdd( taskAssignmentObject, [ selectedObject ], assignmentType );

        if( validObjectToAdd && validObjectToAdd.length > 0 && validObjectToAdd[ 0 ] ) {
            // Update the new assignment origin if coming from project or resource pool
            _updateTaskAssignmentOrigin( validObjectToAdd[ 0 ], newAssignment );
            _removeObject( presentObjects, replaceAssignmentObject, newAssignment );
            taskAssignmentObject.props[replaceAssignmentObject.assignmentType].modelObjects = presentObjects;
        }
    }

    assignmentContext.isReloadTable = true;
    assignmentStateContext.update && assignmentStateContext.update( assignmentContext );
    return assignmentContext;
};

/**
  * Populate the task PAL related assignment data and return the model objects that hold that information.
  *
  * @param {Object} assignementData Assignment data object for spefiifc task
  * @param {String} assignmentType Assignemnt type string value
  * @param {Object} palObject Selected PAL object from UI
  *
  * @returns {Array} Model objects that holds the task PAL assignment infomation for spefific assignment type
  */
var _populateTaskPALData = function( assignementData, assignmentType, palObject ) {
    var modelObjects = [];
    if( assignementData && assignementData[ assignmentType ] && assignementData[ assignmentType ].length > 0  ) {
        _.forEach( assignementData[ assignmentType ], function( assignment ) {
            var assignmentObject = _getAssignmentObject( assignment, assignmentType );
            if( assignmentObject && assignmentObject.taskAssignment ) {
                assignmentObject.isPALAssignment = true;
                assignmentObject.taskAssignment.valueUpdated = true;
                assignmentObject.assignmentOrigin = palObject;
                modelObjects.push( assignmentObject );
            }
        } );
    }
    return {
        modelObjects: modelObjects
    };
};

/**
  * Based on seelcted PAL's from UI , check if PAL infomation is already loaded or need to load
  * and based on that fire the correct event to load the information.
  *
  * @param {Object} assignmentStateContext Obejct that will hold task assignment info.
  *
  * @returns {Object} PAL data object
  */
export let getPALAssignmentData = function( assignmentStateContext ) {
    let localAssignmentData = { ...assignmentStateContext.value };
    var newSelectedPals = [];
    if( localAssignmentData ) {
        var palInfoMap = {};
        // Check if taskAssignmentDataObject is not present that means data is not initialized yet so
        // return the empty selected PALs from here.
        if( !localAssignmentData.taskAssignmentDataObject ) {
            return newSelectedPals;
        }
        // Get the existing PAL info map from input context object and then that map needs to be updated.
        if( localAssignmentData.taskAssignmentDataObject && localAssignmentData.taskAssignmentDataObject.palInfoMap ) {
            palInfoMap = localAssignmentData.taskAssignmentDataObject.palInfoMap;
        }
        var palUidKeys = Object.keys( palInfoMap );

        var selectedPals = localAssignmentData.selectedPals;
        var selPalUids = [];
        newSelectedPals = [];
        // If selected pal is not previously selected and it's information need to be loaded then
        // add that PAL to array and it's information will need to get from server
        _.forEach( selectedPals, function( selPal ) {
            if( selPal && !palInfoMap[ selPal.uid] ) {
                newSelectedPals.push( selPal );
            }
            selPalUids.push( selPal.uid );
        } );

        // Check if some PAL is unseelcted then for those PAL information need to be removed
        for( var idx = 0; idx < palUidKeys.length; idx++ ) {
            var palUidObject = palUidKeys[idx];
            var isRemove = selPalUids.indexOf( palUidObject ) <= -1;
            if( isRemove ) {
                delete palInfoMap[ palUidObject ];
            }
        }

        // Update the PAL info map with updated selected pal info
        localAssignmentData.taskAssignmentDataObject.palInfoMap = palInfoMap;
        assignmentStateContext.update && assignmentStateContext.update( localAssignmentData );
    }
    return newSelectedPals;
};

/**
  * Create the input data for PAL obejcts for information need to be loaded.
  * @param {Object} data Data view model object
  * @param {Object} selObject Selected object from UI
  * @param {Array} selectedPals PAL objects for information need to be loaded
  *
  * @returns {Array} Input data array
  */
export let getPALAssignmentInputData = function( data, selObject, selectedPals ) {
    var inData = [];
    let selectedObject = _.clone( selObject );
    let selectedPALObjects = _.clone( selectedPals );
    // This code is needed in case when coming values to this method is not latest
    // then get the values from below code.
    if( !selectedObject || !selectedPALObjects ) {
        const localDataObject = data.getData();
        selectedObject = localDataObject.validTaskObject;
        selectedPALObjects = localDataObject.newSelectedPals;
    }
    if( selectedPALObjects && selectedPALObjects.length > 0 ) {
        _.forEach( selectedPALObjects, function( selPal ) {
            var object = {
                taskOrTemplate : selectedObject,
                pal: selPal,
                operationMode : 1,
                clientId : selPal.uid
            };
            inData.push( object );
        } );
    }
    return inData;
};

/**
  * Populate the PAL assignment information and update the PAL data map with all assignment information.
  *
  * @param {Array} palDataArray PAL data array that will have PAL related assignmetn info
  * @param {Object} palInfoMap PAL assignment info map
  * @param {Object} assignmentStateContext Assignment data object that contains assignment info
  * @param {Object} subPanelContext Context object to show PAL info is applied
  *
  * @return {Object} PAL info map object
  */
export let populatePALAssignmentInfo = function( palDataArray, palInfoMap, assignmentStateContext ) {
    // Check if input values are not valid or pal data map is null then no need to process further
    // and return from here
    if( !palDataArray || !palInfoMap ) {
        return;
    }

    // Check if assignment state context info is not valid then no need to process further
    // and return the input pal info map object.
    if( !assignmentStateContext || !assignmentStateContext.value ) {
        return;
    }
    let localPalInfoMap = _.clone( palInfoMap );
    let localAssignmentData = { ...assignmentStateContext.value };
    _.forEach( palDataArray, function( taskPalDataObject ) {
        var selPalId = taskPalDataObject.clientId;
        var palDataMap = {};
        var palObject = clientDataModel.getObject( selPalId );

        _.forEach( taskPalDataObject.outData, function( taskPalData ) {
            var taskUid = taskPalData.task.uid;

            var assigneeData = _populateTaskPALData( taskPalData.assigmentData, 'assignee', palObject );
            var reviewersData = _populateTaskPALData( taskPalData.assigmentData, 'reviewers', palObject );
            var acknowledgersData = _populateTaskPALData( taskPalData.assigmentData, 'acknowledgers', palObject );
            var notifyeesData = _populateTaskPALData( taskPalData.assigmentData, 'notifyees', palObject );
            var object = {
                props : {
                    assignee :  assigneeData,
                    reviewers :  reviewersData,
                    acknowledgers :  acknowledgersData,
                    notifyees :  notifyeesData
                }
            };
            palDataMap[ taskUid ] = object;
            localAssignmentData = _updateEditContext( localAssignmentData, taskUid );
        } );
        localPalInfoMap[ selPalId ] = palDataMap;
    } );
    // Check if task assignment data object is not null then update the PAL info map
    // on that object.
    if( localAssignmentData.taskAssignmentDataObject ) {
        localAssignmentData.taskAssignmentDataObject.palInfoMap = localPalInfoMap;
    }

    localAssignmentData.isReloadTable = true;
    // Update the context with all info.
    assignmentStateContext.update && assignmentStateContext.update( localAssignmentData );
};

var _populateUnstaffedProfileRows = function( taskUid, taskProfiles, modelObjects, propName ) {
    if( !taskProfiles || taskProfiles.length <= 0 ) {
        return modelObjects;
    }
    var taskObject = clientDataModel.getObject( taskUid );
    var isValidPropToProcess = false;

    if(  ( isOfType( taskObject, 'EPMReviewTask' ) || isOfType( taskObject, 'EPMRouteTask' )
     || isOfType( taskObject, 'EPMReviewTaskTemplate' ) || isOfType( taskObject, 'EPMRouteTaskTemplate' ) ) && propName === 'reviewers'
     || ( isOfType( taskObject, 'EPMAcknowledgeTask' ) || isOfType( taskObject, 'EPMAcknowledgeTaskTemplate' ) ) && propName === 'acknowledgers' ) {
        isValidPropToProcess = true;
    }

    if( !isValidPropToProcess ) {
        return modelObjects;
    }

    var profileObjects = _.cloneDeep( taskProfiles );
    _.forEach( modelObjects, function( modelObject ) {
        var profileObject = _.find( profileObjects, function( profile ) {
            return modelObject.signoffProfile && modelObject.signoffProfile.uid === profile.uid;
        } );
        // Check if VMO is not null then only get the required number of reviewers
        // and then reduce the count.
        if( profileObject ) {
            var noRequiredReviewers = 0;
            var splitArray = [];
            if( profileObject.requiredReviewers ) {
                splitArray = profileObject.requiredReviewers.split( ' ' );
                if( splitArray && splitArray[ 0 ] && splitArray[ 1 ] ) {
                    noRequiredReviewers = parseInt( splitArray[ 0 ] );
                }
            }

            noRequiredReviewers--;
            if( noRequiredReviewers < 0 ) {
                return null;
            }
            profileObject.requiredReviewers = noRequiredReviewers + ' ' + splitArray[ 1 ];
        }
    } );
    var rowObjects = [];
    var localeTextBundle = _getLocalTextBundle();

    _.forEach( profileObjects, function( profileVMO ) {
        //var displayValue = localeTextBundle.unAssingedFrom;
        // Check if VMO is not null then only get the required number of reviewers
        // and then reduce the count.
        if( profileVMO ) {
            var noRequiredReviewers = 0;
            if( profileVMO.requiredReviewers ) {
                noRequiredReviewers = parseInt( profileVMO.requiredReviewers.split( ' ' ) );
            }
            if( noRequiredReviewers > 0 ) {
                var modelObject = viewModelService.constructViewModelObjectFromModelObject( null, '' );
                modelObject.uid = 'unstaffedUID';
                var displayValue = profileVMO.groupRoleName + '/' + noRequiredReviewers;
                displayValue = messagingSvc.applyMessageParamsWithoutContext( localeTextBundle.unAssingedFrom, [ displayValue ] );
                modelObject.props = {
                    object_string : {
                        uiValues : [ displayValue ]
                    }
                };
                if( modelObject ) {
                    var profileAssignmentObject = _createEmptyTaskDataStructure();
                    profileAssignmentObject.taskAssignment = modelObject;
                    profileAssignmentObject.assignmentOrigin = null;
                    profileAssignmentObject.assignmentType = propName;
                    profileAssignmentObject.signoffProfile = profileVMO;
                    profileAssignmentObject.isRequired = true;
                    profileAssignmentObject.isProfileAssignment = true;
                    rowObjects.push( profileAssignmentObject );
                }
            }
        }
    } );
    Array.prototype.push.apply( rowObjects, modelObjects );
    // Duplicate the signoff profiles and return the unique profiles
    // rowObjects = _.uniqWith( rowObjects, function( objA, objB ) {
    //     return objA.signoffProfile && objB.signoffProfile && objA.signoffProfile.uid === objB.signoffProfile.uid;
    // } );
    return rowObjects;
};

/**
  * Merge the proeprty that has normal assignment and PAL assignment and merge it to
  * input main proerpty value.
  *
  * @param {Object} prop Property object that need to be populated
  * @param {Object} palProp Proeprty obejct that contains nformation coming from PAL
  * @param {String} propName Property name
  *
  */
var _mergePropData = function(  prop, palProp, propName ) {
    if( palProp && propName === 'assignee' && palProp.modelObjects && palProp.modelObjects.length > 0 ) {
        prop.modelObjects = palProp.modelObjects;
    } else if( palProp && propName !== 'assignee'  && palProp.modelObjects ) {
        Array.prototype.push.apply( prop.modelObjects, palProp.modelObjects );
    }
};

/**
  * Get task specific DP data and populate the table
  * @param {Object} propObject Property object that need to be populated
  * @param {String} propName Property name
  * @param {Object} participantInfoMap Participant info map object that contians all DP's data
  *
  * @returns {Array} Model objects array
  */
var _mergeDPData = function( propObject, propName, participantInfoMap ) {
    var suuportedDPTypes = propObject.supportedDPTypes;
    var modelObjects = propObject.modelObjects;
    if( suuportedDPTypes && suuportedDPTypes.length > 0 ) {
        _.forEach( suuportedDPTypes, function( dpType ) {
            if( participantInfoMap.hasOwnProperty( dpType ) ) {
                var participantObjects = participantInfoMap[ dpType ].assignees;
                if( propName === 'assignee' ) {
                    modelObjects = [];
                }

                _.forEach( participantObjects, function( participantObj ) {
                    var existingParticipant = _.cloneDeep( participantObj );
                    existingParticipant.assignmentType = propName;
                    modelObjects.push( existingParticipant );
                } );
            }
        } );
    }
    return modelObjects;
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

export let getTaskAssignmentData = function( taskUid, taskInfoObject, palInfoMap, participantInfoMap, isTableTaskData ) {
    var taskInfoObject = _.cloneDeep( taskInfoObject );
    if( !taskUid || !taskInfoObject ) {
        return taskInfoObject;
    }
    //taskInfoObject =  taskInfoMap[ taskUid ];
    var taskObject = clientDataModel.getObject( taskUid );
    var isTaskCompleted = workflowAssinmentUtilSvc.isTaskCompleted( taskObject );
    for( var propName in taskInfoObject.props ) {
        if( taskInfoObject.props.hasOwnProperty( propName ) ) {
            var isPalDataExist = false;
            if( !isTaskCompleted ) {
                for( var palKey in palInfoMap ) {
                    var palProp = null;
                    isPalDataExist = true;
                    var map = palInfoMap[ palKey ];

                    var palTaskInfoObject = map[ taskUid ];

                    if( palTaskInfoObject ) {
                        palProp = _.cloneDeep( palTaskInfoObject.props[ propName ] );
                    }
                    _mergePropData(  taskInfoObject.props[ propName ], palProp, propName );
                }
            }

            if( !isPalDataExist ) {
                _mergePropData( taskInfoObject.props[ propName ], null, propName );
            }

            var modelObjects = _.clone( taskInfoObject.props[ propName ].modelObjects );
            // Remove the duplicates if present in presetObjects list. If duplicate resource pool
            // present then it should not filter it out.
            if( modelObjects && modelObjects.length > 1 ) {
                modelObjects = _.uniqWith( modelObjects, function( objA, objB ) {
                    return objA.taskAssignment.uid === objB.taskAssignment.uid
                     && !_isDuplicateResourcePoolObjects( objA.taskAssignment, objB.taskAssignment );
                } );
                taskInfoObject.props[ propName ].modelObjects = modelObjects;
            }

            if( propName !== 'assignee' && isTableTaskData ) {
                taskInfoObject.props[ propName ].modelObjects = _populateUnstaffedProfileRows( taskUid, taskInfoObject.taskProfiles, taskInfoObject.props[ propName ].modelObjects, propName );
            }
            taskInfoObject.props[ propName ].modelObjects = _mergeDPData( taskInfoObject.props[ propName ],  propName, participantInfoMap );


            if( propName === 'assignee' && isTableTaskData && taskInfoObject.props.assignee.modelObjects
             && taskInfoObject.props.assignee.modelObjects.length <= 0 && taskObject &&  _multiUserTasks.indexOf( taskObject.type ) <= -1  ) {
                var assigneeVMO = _getUnStaffedVMOObject();
                taskInfoObject.props[ propName ].modelObjects = [ assigneeVMO ];
            }
        }
    }
    return taskInfoObject;
};

/**
  * Build all rows that need to be shown in assignment table with input object and return
  * new task assignemtn obejct that will be specific for assignment table for respective changes.
  *
  * @param {Object} taskAssignmentObject Task assignment object that have all task information
  * @param {Array} taskObjects Task objects that need to be shown in assignment table
  *
  * @returns {Object} taskAssignmentObject Task assignment object that have all task information
  */
export let populateAssignmentTableRowData = function( taskAssignmentObject, taskObjects ) {
    if( !taskAssignmentObject || !taskObjects || taskObjects.length <= 0 ) {
        return taskAssignmentObject;
    }
    taskAssignmentObject = _.cloneDeep( taskAssignmentObject );
    var participantMap = taskAssignmentObject.participantInfoMap;
    var palInfoMap = taskAssignmentObject.palInfoMap;
    _.forEach( taskObjects, function( taskObject ) {
        var taskUid = taskObject.uid;
        var taskInfoMap = taskAssignmentObject.taskInfoMap;
        if( taskInfoMap ) {
            taskInfoMap[ taskUid ] = exports.getTaskAssignmentData( taskUid, taskAssignmentObject.taskInfoMap[ taskUid ], palInfoMap, participantMap, true );
        }
    } );
    return taskAssignmentObject;
};

/**
  * Build all rows that need to be shown in assignment table with input object and return
  * new task assignemtn obejct that will be specific for assignment table for respective changes.
  *
  * @param {Object} taskAssignmentObject Task assignment object that have all task information
  * @param {Array} taskObjects Task objects that need to be shown in assignment table
  * @param {boolean} includeHideNodeInfo To indicate that do we need to include hidden node info as well.
  * This is mainly used when we have applied PAL and we need to do PAL assignment on hidden nodes.
  * @returns {Object} taskAssignmentObject Task assignment object that have all task information
  */
export let populateAssignmentFullTableRowData = function( taskAssignmentObject, taskObjects, includeHideNodeInfo ) {
    if( !taskAssignmentObject || !taskObjects || taskObjects.length <= 0 ) {
        return taskAssignmentObject;
    }
    taskAssignmentObject = exports.populateAssignmentTableRowData( taskAssignmentObject, taskObjects );
    // Check if hiddden task info need to be populated then only go further
    if( !includeHideNodeInfo ) {
        return taskAssignmentObject;
    }
    var palInfoMap = taskAssignmentObject.palInfoMap;
    var allTaskObjects = taskAssignmentObject.allTasksObjects;
    // Check if pal is applied then only process further else return from here
    if(  !palInfoMap || _.isEmpty( palInfoMap ) || !allTaskObjects || allTaskObjects.length <= 0 ) {
        return taskAssignmentObject;
    }
    var taskInfoMap = {};
    for( var palId in palInfoMap ) {
        var taskObjects = palInfoMap[ palId ];
        // check if task object info present in PAL map or not.  If not present then no
        // need to contunue further
        if( !taskObjects || taskObjects.length <= 0 ) {
            continue;
        }

        // Iterate for each task info present in PAL map and then get that info
        for( var taskUid  in taskObjects ) {
            var taskInfoObject = taskObjects[ taskUid ];
            if( allTaskObjects.indexOf( taskUid ) > -1 || !taskInfoObject ) {
                continue;
            }

            // Check id information is not present in task info map then directly add it and
            // if present then merge it.
            if( !taskInfoMap[taskUid ] ) {
                taskInfoMap[taskUid ] = _.cloneDeep( taskInfoObject );
            } else {
                var existingTaskInfoObject = taskInfoMap[taskUid ];
                for( var propName in taskInfoObject.props ) {
                    // Merge the existing task info property to new proeprty coming from PAL
                    _mergePropData(  existingTaskInfoObject.props[ propName ], taskInfoObject.props[ propName ], propName );
                    var modelObjects = existingTaskInfoObject.props[ propName ].modelObjects;
                    // Remove the duplicates if present in presetObjects list. If duplicate resource pool
                    // present then it should not filter it out.
                    if( modelObjects && modelObjects.length > 1 ) {
                        modelObjects = _.uniqWith( modelObjects, function( objA, objB ) {
                            return objA.taskAssignment.uid === objB.taskAssignment.uid && !_isDuplicateResourcePoolObjects( objA.taskAssignment, objB.taskAssignment );
                        } );
                        existingTaskInfoObject.props[ propName ].modelObjects = modelObjects;
                    }
                }
            }
        }
    }
    // Iterate for new task info map generate from PAL assignment and then check if this task info
    // is already not present in main map then only add it
    for( var taskUid in taskInfoMap ) {
        if( !taskAssignmentObject.taskInfoMap[ taskUid ] ) {
            taskAssignmentObject.taskInfoMap[ taskUid ] = taskInfoMap[ taskUid ];
        }
    }
    return taskAssignmentObject;
};

/**
  * Update the task specific DP's that arget is being used.
  * @param {Object} targetObject Target object where assignment need to be added
  * @param {Array} sourceObjects Updated task assignment objects that need to be added
  * @param {String} dpName DP name which need to be updated
  * @param {Object} participantInfoMap Participant info map object
  */
var _updateTaskDPAssignments = function( targetObject, sourceObjects, dpName, participantInfoMap  ) {
    var newDeferredParticipants = [];

    _.forEach( sourceObjects, function( vmoObject ) {
        var valueUpdated = true;
        var newParticipant = _createEmptyTaskDataStructure();
        newParticipant.internalName = dpName;
        newParticipant.taskAssignment = vmoObject;
        var dpDisplayName = dpName;
        // Set the assignment origin as DP display name
        if( participantInfoMap[ dpName ] && participantInfoMap[ dpName ].displayName ) {
            dpDisplayName = participantInfoMap[ dpName ].displayName;
        }
        newParticipant.assignmentOrigin = dpDisplayName;
        newDeferredParticipants.push( newParticipant );
        newParticipant.taskAssignment.valueUpdated = valueUpdated;
    } );

    if( targetObject.assignmentObject && targetObject.assignmentObject.assignmentType === 'assignee' && newDeferredParticipants && newDeferredParticipants[0] ) {
        newDeferredParticipants = [ newDeferredParticipants[ 0 ] ];
    } else {
        var participantObjects = _.cloneDeep( participantInfoMap[ dpName ].assignees );
        _removeObject( participantObjects, targetObject.assignmentObject, newDeferredParticipants );
        newDeferredParticipants = participantObjects;
    }

    participantInfoMap[ dpName ].assignees = newDeferredParticipants;
};

/**
  * Update the task assignment and reload the assignment table based on input values
  * @param {Object} targetObject Target object where assignment need to be added
  * @param {Array} sourceObjects Objects that need to be added as assignment
  * @param {Object} taskAssignmentObject Task assignment object
  */
export let _updateTaskAssignments = function( targetObject, sourceObjects, taskAssignmentObject, assignmentStateContext ) {
    var replaceAssignmentObject = targetObject.assignmentObject;
    var isPalAssignment = replaceAssignmentObject.isPALAssignment;
    var newTaskAssignments = [];
    var assignmentType = workflowAssinmentUtilSvc.getAssignmentTypeBasedOnTarget( targetObject );
    _.forEach( sourceObjects, function( vmoObject ) {
        var valueUpdated = true;
        var newAssignment = _createEmptyTaskDataStructure();
        newAssignment.internalName = null;
        newAssignment.taskAssignment = vmoObject;
        newAssignment.assignmentOrigin = null;
        newAssignment.assignmentType = assignmentType;
        if( targetObject.signoffProfile ) {
            newAssignment.assignmentOrigin = newAssignment.signoffProfile;
            newAssignment.assignmentOrigin = null;
        }
        // Update the new assignment origin if coming from project or resource pool
        _updateTaskAssignmentOrigin( vmoObject, newAssignment );
        newTaskAssignments.push( newAssignment );
        newAssignment.taskAssignment.valueUpdated = valueUpdated;
    } );


    // Check is user is trying to remove the assignment that came from PAL then get the
    // info from pal info map and new assignment will go as normal assignment and it will not reference
    // to PAL.
    if( isPalAssignment && replaceAssignmentObject.assignmentOrigin.hasOwnProperty( 'uid' ) ) {
        var palUid = replaceAssignmentObject.assignmentOrigin.uid;
        taskAssignmentObject = assignmentStateContext.taskAssignmentDataObject.palInfoMap[ palUid ][ targetObject.taskUid ];
    }

    var presentObjects = taskAssignmentObject.props[ assignmentType ].modelObjects;

    if( targetObject.assignmentObject.signoffProfile === undefined || targetObject.assignmentObject.signoffProfile === null ) {
        _removeObject( presentObjects, targetObject.assignmentObject );
    }

    if( isPalAssignment ) {
        taskAssignmentObject = assignmentStateContext.taskAssignmentDataObject.taskInfoMap[ targetObject.taskUid];
        presentObjects = taskAssignmentObject.props[replaceAssignmentObject.assignmentType].modelObjects;
    }
    // Check if assignment type is assignee then use 0th index object and update the table and task info object
    if( assignmentType === 'assignee' && newTaskAssignments && newTaskAssignments[ 0 ] ) {
        presentObjects = [ newTaskAssignments[ 0 ] ];
    } else {
        Array.prototype.push.apply( presentObjects, newTaskAssignments );
    }

    taskAssignmentObject.props[assignmentType].modelObjects = presentObjects;
};


/**
  * Get the task specifci assignment information and store it on the context so it can be
  * used like showing the panel for spefiic task or task template object.
  *
  * @param {Object} taskAssignmentDataObject task assignment context object where information need to be stored
  * @param {Object} selectedObject Selected object for information need to be stored
  *
  * @returns {Object} Panel context object to specify selection specific assignmetn information
  */
export let registerAssignmentPanelContext = function( taskAssignmentDataObject, selectedObject ) {
    var panelContext = {};
    if( !taskAssignmentDataObject || !selectedObject ) {
        return panelContext;
    }

    var taskAssignmentObject = _.cloneDeep( taskAssignmentDataObject );
    var participantMap = taskAssignmentObject.participantInfoMap;
    var palInfoMap = taskAssignmentObject.palInfoMap;
    var taskInfoMap = taskAssignmentObject.taskInfoMap;
    var taskUid = selectedObject._childObj.uid;
    var taskObject = clientDataModel.getObject( taskUid );
    // Get the task assignment information
    var taskInfoObject = exports.getTaskAssignmentData( taskUid, taskInfoMap[ taskUid ], palInfoMap, participantMap );
    if( !taskInfoObject ) {
        taskInfoObject = {};
    }
    panelContext.taskInfoObject = taskInfoObject;
    var selectionBasedParticipants = taskInfoObject.taskDeferredParticipantsTypes;
    panelContext.selectionBasedParticipants = selectionBasedParticipants;
    panelContext.deferredAssignments = participantMap;
    panelContext.selectedTaskObject = taskObject;
    return panelContext;
};

export let dummySaveTaskAssignment = function( ctx ) {
    saveTaskAssignments( ctx );
};

/**
  * Update the selected PALs info on the context object.
  *
  * @param {Array} selPals Selected PALs from UI.
  * @param {Object} assignmentStateContext context object
  */
export let updateSelectedPALContextInfo = function( selPals, assignmentStateContext ) {
    if( assignmentStateContext ) {
        const localContext = { ...assignmentStateContext.value };
        localContext.selectedPals = _.clone( selPals );
        assignmentStateContext.update && assignmentStateContext.update( localContext );
    }
};

/**
  * Update the DP map with updated particiapnts from panel.
  *
  * @param {Object} taskInfo Object that will hold task specific info that need to be updated.
  * @param {Object} localAssignmentState Context object where particpant related changes will be stored
  *
  * @returns {Object} DP map context object
  */
var _updateTaskDeferredParticipants = function( taskInfo, localAssignmentState ) {
    // clone the input context object and then get the participant info from that and then
    // update it.
    let assignmentData = { ...localAssignmentState };
    var taskInfoObject = { ...taskInfo };
    let participantInfoMap = {};
    participantInfoMap = assignmentData.taskAssignmentDataObject.participantInfoMap;
    var participantSectionObjects = taskInfoObject.participantSectionObjects;
    if( participantSectionObjects && !_.isEmpty( participantSectionObjects ) ) {
        _.forEach( participantSectionObjects, function( participantObject ) {
            var participantType = participantObject.internalName;
            var displayName = participantObject.displayName;
            var selectionMode = participantObject.selectionModelMode;

            var existingParticipants = participantInfoMap[ participantType ].assignees;

            var assigneeObjects = _.clone( participantObject.modelObjects );
            var newDeferredParticipants = [];
            if( assigneeObjects && _.isEmpty( assigneeObjects ) ) {
                var modelObject = _getUnStaffedVMOObject();
                assigneeObjects.push( modelObject );
            }

            _.forEach( assigneeObjects, function( vmoObject ) {
                var valueUpdated = true;
                var newParticipant = _createEmptyTaskDataStructure();
                newParticipant.internalName = participantType;
                newParticipant.taskAssignment = vmoObject;
                newParticipant.assignmentOrigin = displayName;
                newParticipant.selectionMode = selectionMode;
                newDeferredParticipants.push( newParticipant );

                var index1 = _.findIndex( existingParticipants, function( participant ) {
                    return participant.taskAssignment.uid === vmoObject.uid;
                } );
                if( index1 > -1 ) {
                    valueUpdated = false;
                    // Check if valueUpdated value is present and true then change the value to true as save doesn't happen yet.
                    if( existingParticipants[ index1 ].taskAssignment && existingParticipants[ index1 ].taskAssignment.valueUpdated ) {
                        valueUpdated = existingParticipants[ index1 ].taskAssignment.valueUpdated;
                    }
                }
                newParticipant.taskAssignment.valueUpdated = valueUpdated;
            } );
            participantInfoMap[ participantType ].assignees = newDeferredParticipants;
        } );
    }
    return assignmentData;
};


/**
  * Update the task related assignemnt information that will be like assignee, reviewers, acknowledgers or notifyers
  *
  * @param {Object} taskInfo Task info object
  * @param {Object} taskObject Task Object whose information need to be updated
  * @param {Object} localAssignmentState Context object where particpant related changes will be stored
  *
  * @returns {Object} Updated context object
  */
var _updateTaskRelatedAssignments = function( taskInfo, taskObject, localAssignmentState ) {
    var palTaskAssignment = {};
    let assignmentData = { ...localAssignmentState };

    var palInfoMap = assignmentData.taskAssignmentDataObject.palInfoMap;
    var taskInfoObject = _.clone( taskInfo );
    var assigneeDataObject = createTaskAssignmentObjects( taskInfoObject.props.assignee.modelObjects, 'assignee', false, palTaskAssignment, palInfoMap );

    var assignee = assigneeDataObject.taskAssignemnts;
    if( taskInfoObject.props.assignee.supportedDPTypes && taskInfoObject.props.assignee.supportedDPTypes.length > 0 ) {
        assignee = [];
    }

    palTaskAssignment = assigneeDataObject.palTaskAssignment;

    var reviewerAssignmentType = 'reviewers';
    var isAcknowledgeTaskSelected = false;
    // Check if task is of type acknowledge task or acknowledge task template then we need to update the properties
    // for acknowledgers but from panel values comes as reviewers or additional reviewers
    if( isOfType( taskObject, 'EPMAcknowledgeTask' ) || isOfType( taskObject, 'EPMAcknowledgeTaskTemplate' ) ) {
        isAcknowledgeTaskSelected = true;
    }
    var reviewerDataObject = createTaskAssignmentObjects( taskInfoObject.props.reviewers.modelObjects,
        reviewerAssignmentType, true, palTaskAssignment, palInfoMap );
    palTaskAssignment = reviewerDataObject.palTaskAssignment;
    var reviewers = reviewerDataObject.taskAssignemnts;

    if( taskInfoObject.props.additionalReviewers ) {
        var additionalReviewerDataObject = createTaskAssignmentObjects( taskInfoObject.props.additionalReviewers.modelObjects,
            reviewerAssignmentType, true, palTaskAssignment, palInfoMap );
        palTaskAssignment = additionalReviewerDataObject.palTaskAssignment;
        var additionalReviewers = additionalReviewerDataObject.taskAssignemnts;

        Array.prototype.push.apply( reviewers, additionalReviewers );
    }

    var acknowledgers = [];

    if( isAcknowledgeTaskSelected ) {
        acknowledgers = _.clone( reviewers );
        // This change is mainly needed to set the correct assignmentType on all assignments
        // added on acknowledge task as on panel it shows under reviewers and additional reviewers
        // section but actually it's getting added as acknowledgers.
        _.forEach( acknowledgers, function( vmoObject ) {
            vmoObject.assignmentType = 'acknowledgers';
        } );
        reviewers = [];
    }

    var notifyees = [];
    // For route task update acknowledgers and notifyers proeprty coming from panel
    if( isOfType( taskObject, 'EPMRouteTask' ) || isOfType( taskObject, 'EPMRouteTaskTemplate' ) ) {
        var acknowledgersDataObject = createTaskAssignmentObjects( taskInfoObject.props.acknowledgers.modelObjects, 'acknowledgers', false, palTaskAssignment, palInfoMap );
        acknowledgers = acknowledgersDataObject.taskAssignemnts;
        palTaskAssignment = acknowledgersDataObject.palTaskAssignment;

        var notifyeesDataObject = createTaskAssignmentObjects( taskInfoObject.props.notifyees.modelObjects, 'notifyees', false, palTaskAssignment, palInfoMap );
        notifyees = notifyeesDataObject.taskAssignemnts;
        palTaskAssignment = notifyeesDataObject.palTaskAssignment;
    }
    var taskValue = assignmentData.taskAssignmentDataObject.taskInfoMap[ taskObject.uid ];
    if( !taskValue || !taskValue.props ) {
        return;
    }
    taskValue.props.assignee.modelObjects =  assignee;
    taskValue.props.reviewers.modelObjects =  reviewers;
    taskValue.props.acknowledgers.modelObjects =  acknowledgers;
    taskValue.props.notifyees.modelObjects =  notifyees;

    // Check if pal is applied then only process further else return from here
    if( palInfoMap && !_.isEmpty( palInfoMap ) ) {
        for( var palId in palInfoMap ) {
            var palObject = palInfoMap[ palId ];
            // Check if task is present in PAL map then only update the pal map
            if( palObject && palObject.hasOwnProperty( taskObject.uid ) ) {
                var palAssignmentProps = palObject[ taskObject.uid ].props;
                var palTaskAssignmentObject = palTaskAssignment[ palId ];

                // Set the individual properties for each task and set the properties correctly so that PAL
                // map will have latest information
                for( var propName in palAssignmentProps ) {
                    if( palTaskAssignmentObject && palTaskAssignmentObject[ propName ] ) {
                        palAssignmentProps[ propName ].modelObjects =  palTaskAssignmentObject[ propName ];
                    } else {
                        palAssignmentProps[ propName ].modelObjects =  [];
                    }
                }
            }
        }
    }
    return assignmentData;
};

/**
  * Update the task assignment info based on input task info object.
  *
  * @param {Object} taskInfoObject Task info object which contains updated info from category panel.
  * @param {Object} taskObject Task object whose info has been updated.
  * @param {Object} assignmentStateContext Context object where task assignment info need to be updated.
  * @param {Object} newSelectedTaskObject New task object that need to be selected when table reload.
  *
  * @returns {Object} Updated task info object that will be used to show task assignments categories
  */
export let updatePropAssignmentContextInfo = function( taskInfoObject, taskObject,  assignmentStateContext, newSelectedTaskObject ) {
    const localTaskInfo = { ...taskInfoObject };
    if( taskInfoObject && taskObject && assignmentStateContext ) {
        let localContext = { ...assignmentStateContext.getValue() };
        localContext = _updateTaskRelatedAssignments( taskInfoObject, taskObject, localContext );
        localContext = _updateTaskDeferredParticipants( taskInfoObject, localContext );
        // Set this to true so that table can be reloaded.
        localContext.isReloadTable = true;
        localContext = _updateEditContext( localContext, taskObject.uid );
        // Check if newSelectedTaskObject is not null and it is valid EPMTask or EPMTaskTemplate object then only
        // we need to set this object on assignment state. Use case is mainly for inbox assignment table or upcoming
        // task table where assignment panel is up and modified the assignment and then user has changed the selection
        // from table and then we show warning message to user and user selected save action on message to we need to update
        // assignment for previous selection and reload the table and then select the new input selected task on table again.
        if( newSelectedTaskObject && newSelectedTaskObject.uid &&
             ( isOfType( newSelectedTaskObject, 'EPMTask' ) || isOfType( newSelectedTaskObject, 'EPMTaskTemplate' ) ) ) {
            localContext.newTaskSelectedUid = newSelectedTaskObject.uid;
        } else {
            // Case will be user select the task and modify the assignment and then click
            // on save button in that case we reset the table and we need to empty the selection
            // on selection Model as well and to handle that case we are using emptySelection string
            // as workaround right now. If we pass selection model to data provider then on reset of
            // data provider selection model doesn't get empty. So this key will handle that case.
            localContext.newTaskSelectedUid = 'emptySelection';
        }
        assignmentStateContext.update && assignmentStateContext.update( localContext );
        localTaskInfo.updatePropContext = undefined;
    }
    return localTaskInfo;
};


/**
  * Update the task specific assignment on drop operation where category panel and selected task
  * on tree shows same task info only. This will be called only in that case.
  *
  * @param {Object} targetObject Target object where assignment need to be updated
  * @param {Array} validObjects Valid objects that need to be added
  * @param {Object} taskInfoObject Context object that holds all task related assignment info
  */
var _updateSelectedTaskAssignmentOnDrop = function( targetObject, validObjects, taskInfoObject ) {
    if( !validObjects || _.isEmpty( validObjects ) ) {
        return;
    }
    // Get the assignment type user is going to create using drop action and check if
    var assignmentType = workflowAssinmentUtilSvc.getAssignmentTypeBasedOnTarget( targetObject, taskInfoObject );
    var isParticipantProp = false;
    var taskDPParticipant = _.find( taskInfoObject.participantSectionObjects, {
        internalName: assignmentType
    } );
    if( taskDPParticipant ) {
        isParticipantProp = true;
    }
    // Using panel update as all assignments are visible on categry panel so it will update category first and then
    // update the table
    workflowAssignmentPanelSvc.addSelectedUsersOnPanel( assignmentType, isParticipantProp, null, validObjects, taskInfoObject );
};

/**
  * Update the task specific assignment on drop operation where category panel and selected task
  * on tree shows differnt task info. This will be called only in that case.
  *
  * @param {Object} targetObject Target object where assignment need to be updated
  * @param {Array} validObjects Valid objects that need to be added
  * @param {Object} assignmentStateContext Context object that holds all task related assignment info
  */
var _updateTaskAssignmentOnDrop = function( targetObject, validObjects, assignmentStateContext ) {
    let localAssignmentContext = { ... assignmentStateContext.value };
    if( !validObjects || _.isEmpty( validObjects ) ) {
        return;
    }
    // Get the assignment type user is going to create using drop action and check if it's DP assignment
    // or not. If it's DP assignment that means user is droping on panel
    var assignmentType = workflowAssinmentUtilSvc.getAssignmentTypeBasedOnTarget( targetObject, null );
    var taskDPParticipant = _.find( localAssignmentContext.taskAssignmentDataObject.participantInfoMap, {
        internalName: assignmentType
    } );
    // Check if DP Participant object is not null then we need to call below method to change the particiapnt map
    // with new participant that will be added.
    if( taskDPParticipant ) {
        _updateTaskDPAssignments( targetObject, validObjects, assignmentType, localAssignmentContext.taskAssignmentDataObject.participantInfoMap );
    } else {
        var taskInfoObject = localAssignmentContext.taskAssignmentDataObject.taskInfoMap[ targetObject._childObj.uid ];
        var validObjectToAdd = _getValidObjectToAdd( taskInfoObject, validObjects, assignmentType );
        if( validObjectToAdd && validObjectToAdd.length > 0 ) {
            // In case of direct table drop we need to handle it differently than panel section drop as there
            // it will show all assignements like assignments coming from PAL as well while on table drop
            // it won't show assignment from PAL so it won't update directly so calling below method to show
            // the table info correctly.
            _updateTaskAssignments( targetObject, validObjects, taskInfoObject, localAssignmentContext );
        }
    }
    // Set this to true so that table can be reloaded.
    localAssignmentContext.isReloadTable = true;
    if ( !_isValidTaskObject( targetObject ) || targetObject.uid === 'unstaffedUID' ) {
        localAssignmentContext = _updateEditContext( localAssignmentContext, targetObject.uid );
    }
    assignmentStateContext.update && assignmentStateContext.update( localAssignmentContext );
};

/**
 * This function is responsible to check whether the target object in case of drag and drop from assignment table is valid task or not
 *
 * @param { Object } targetObj - Target object to valid whether valid task or not
 */

var _isValidTaskObject = function( targetObj ) {
    return !( isOfType( targetObj, 'EPMDoTask' ) || isOfType( targetObj, 'EPMReviewTask' ) || isOfType( targetObj, 'EPMAcknowledgeTask' ) ||
        isOfType( targetObj, 'EPMRouteTask' ) || isOfType( targetObj, 'EPMConditionTask' ) ||
        isOfType( targetObj, 'EPMDoTaskTemplate' ) || isOfType( targetObj, 'EPMReviewTaskTemplate' ) ||
        isOfType( targetObj, 'EPMAcknowledgeTaskTemplate' ) || isOfType( targetObj, 'EPMRouteTaskTemplate' ) ||
        isOfType( targetObj, 'EPMConditionTaskTemplate' ) || isOfType( targetObj, 'EPMTaskTemplate' ) );
};
/**
  * Update the assignment table with the source objects being drop on table directly.
  *
  * @param {Object} targetObject Target object where assignment need to be updated
  * @param {Array} sourceObjects Source objects that need to be updated
  * @param {Object} props Props object that holds all context info
  * @param {Object} baseActiveFiltersStructure Base active filters curretnly applied
  */
export let addTaskAssignmentsOnTable = function( targetObject, sourceObjects, props, baseActiveFiltersStructure ) {
    const addUserPanelState = props.subPanelContext.addUserPanelState;
    const taskInfoObject = props.subPanelContext.taskInfoObject;
    if( _isValidTaskObject( targetObject ) ) {
        taskInfoObject.taskObject = null;
    }
    if( !addUserPanelState ) {
        return;
    }

    // Call this method to get the correct group member based on current context criteria group or role from user if user obejct is
    // being dispalyed on user picker panel then use that to get correct group member and add it to table
    workflowAssinmentUtilSvc.getValidObjectsToAdd( addUserPanelState.criteria, sourceObjects, baseActiveFiltersStructure ).then( function( validObjects ) {
        // Check if valid objects are not empty then only update the table
        if( validObjects && validObjects.length > 0 ) {
            // Check if we are trying to drop the task for category are already visible then we take differnet path
            // to update the table like update the sections first and that update will trigger table refresh. In other case
            // we are updating the table first and that won't need section refresh as we selected some other task.
            if( targetObject && targetObject._childObj && taskInfoObject && taskInfoObject.taskObject && taskInfoObject.taskObject.uid === targetObject._childObj.uid ) {
                _updateSelectedTaskAssignmentOnDrop( targetObject, validObjects, taskInfoObject );
            } else {
                _updateTaskAssignmentOnDrop( targetObject, validObjects, props.assignmentState );
            }
        }
    } );
};

/**
  * enable replace assignment panel for replacing the exisiting assignments
  *
  * @param {Object} commandContext context from the command which needs to pass onto the panel
  *
  *
  *
  */
export let enableReplaceTaskAssignmentPanel = function( commandContext ) {
    const { dialogActionForReplaceContextMenu } = commandContext;
    if( dialogActionForReplaceContextMenu ) {
        let replaceDialogOptions = {
            view: 'Awp0ReplaceTaskAssignment',
            parent: '.aw-layout-workareaMain',
            placement: 'right',
            width: 'STANDARD',
            height: 'FULL',
            push: false,
            isCloseVisible: false,
            subPanelContext: {
                selectedAssignemnt: commandContext.selected[0],
                assignmentState: commandContext.assignmentState,
                selectionData: commandContext.selectionData
            }
        };
        dialogActionForReplaceContextMenu.show( replaceDialogOptions );
    } else {
        const { dialogAction } = commandContext;
        if( dialogAction ) {
            let replaceDialogOptions = {
                view: 'Awp0ReplaceTaskAssignment',
                parent: '.aw-layout-workareaMain',
                placement: 'right',
                width: 'STANDARD',
                height: 'FULL',
                push: false,
                isCloseVisible: false,
                subPanelContext: {
                    selectedAssignemnt: commandContext.selectionData.selected[0],
                    assignmentState: commandContext.assignmentState,
                    selectionData: commandContext.selectionData
                }
            };
            dialogAction.show( replaceDialogOptions );
        }
    }
};

/**
  * Remove the selected assignment information from PST and update the info in cache.
  *
  * @param {Object} selectedObjs Selected Assignment object that need to be removed
  * @param {Object} assignmentStateContext Assignment context
  */
export let removeTaskAssignmentPST = function( selectedObjs, assignmentStateContext ) {
    let assignmentContext = { ...assignmentStateContext.value };
    _.forEach( selectedObjs, function( selected ) { 
        if( !selected || !selected.type || !selected.uid || !assignmentStateContext || !assignmentStateContext.taskAssignmentDataObject ) {
            return;
        }
        assignmentContext = _updateEditContext( assignmentContext, selected.taskUid );
    
        var taskAssignmentObject = assignmentContext.taskAssignmentDataObject.taskInfoMap[ selected.taskUid ];
        var removeAssignmentObject = selected.assignmentObject;
        var isPalAssignment = removeAssignmentObject.isPALAssignment;
        var isDPAssignment = removeAssignmentObject.internalName !== null;
    
        var profileObject = removeAssignmentObject.signoffProfile;
    
        if( profileObject ) {
            // Check if profile object is not VMO then create the VMO object first and then
            // increment the count.
            if( !viewModelService.isViewModelObject( profileObject ) ) {
                profileObject = viewModelService.createViewModelObject( profileObject );
                profileObject.requiredReviewers = profileObject.props.number_of_signoffs.dbValues[ 0 ] + ' ' + parentData.i18n.required;
            }
            var splitValues = profileObject.requiredReviewers.split( ' ' );
            if( splitValues && splitValues.length === 2 && splitValues[ 0 ] && splitValues[ 1 ] ) {
                var reviewersNeeded = parseInt( splitValues[ 0 ] );
                profileObject.requiredReviewers = reviewersNeeded + 1 + ' ' + splitValues[ 1 ];
            }
        }
    
        if( isPalAssignment && removeAssignmentObject.assignmentOrigin.hasOwnProperty( 'uid' ) ) {
            var palUid = removeAssignmentObject.assignmentOrigin.uid;
            taskAssignmentObject = assignmentContext.taskAssignmentDataObject.palInfoMap[ palUid ][ selected.taskUid];
        }
        var presentObjects = taskAssignmentObject.props[removeAssignmentObject.assignmentType].modelObjects;
        _removeObject( presentObjects, removeAssignmentObject );
        taskAssignmentObject.props[removeAssignmentObject.assignmentType].modelObjects = presentObjects;
    
        var participantInfoMap =  assignmentContext.taskAssignmentDataObject.participantInfoMap;
        if( isDPAssignment && participantInfoMap[ removeAssignmentObject.internalName ] ) {
            var participantObjects = participantInfoMap[ removeAssignmentObject.internalName ].assignees;
            _removeObject( participantObjects, removeAssignmentObject );
            // If all DP participant is removed then add the unassiged DP.
            if( participantObjects && participantObjects.length === 0 ) {
                var modelObject = _getUnStaffedVMOObject();
    
                var existingParticipant = _createEmptyTaskDataStructure();
    
                existingParticipant.internalName = removeAssignmentObject.internalName;
                existingParticipant.taskAssignment = modelObject;
                existingParticipant.assignmentOrigin = removeAssignmentObject.assignmentOrigin;
                existingParticipant.assignmentType = removeAssignmentObject.assignmentType;
    
                participantObjects.push( existingParticipant );
            }
        }
    
    });
    // Set this to true so that table can be reloaded.
    assignmentContext.isReloadTable = true;
    assignmentStateContext.update && assignmentStateContext.update( assignmentContext );
};

/**
  * This factory creates a service and returns exports
  *
  * @member Awp0WorkflowAssignmentService
  */

export default exports = {
    populateTaskAssignmentData,
    removeTaskAssignment,
    replaceTaskAssignment,
    saveTaskAssignments,
    populatePALAssignmentInfo,
    populateAssignmentTableRowData,
    populateAssignmentFullTableRowData,
    getPALAssignmentData,
    getPALAssignmentInputData,
    getTaskAssignmentData,
    addTaskAssignmentsOnTable,
    registerAssignmentPanelContext,
    dummySaveTaskAssignment,
    updateSelectedPALContextInfo,
    updatePropAssignmentContextInfo,
    setEditHandlerContext,
    registerEditHandlerContext,
    saveEdits,
    enableReplaceTaskAssignmentPanel,
    removeTaskAssignmentPST
};

